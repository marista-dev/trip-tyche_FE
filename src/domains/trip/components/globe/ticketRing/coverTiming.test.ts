import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const trackMock = vi.fn();
vi.mock('@/libs/analytics', () => ({
    ANALYTICS_EVENTS: { TICKET_COVER_TIMING: 'ticket_cover_timing' },
    track: (...args: unknown[]) => trackMock(...args),
}));
vi.mock('@/libs/perf', () => ({
    perfNow: () => Date.now(),
    perfMark: () => {},
    perfLog: () => {},
    perfClearMarks: () => {},
}));

const { beginCoverTiming, currentCoverTimingId, endCoverTiming, markCoverDrawn, markCoversResolved, markRingBuilt } =
    await import('./coverTiming');

const img = (w = 4000, h = 3000) => ({ naturalWidth: w, naturalHeight: h }) as HTMLImageElement;

/** 카드가 커버를 그리고 렌더 콜백을 받는 과정을 흉내 낸다 */
const draw = (url: string, drawMs = 1, image = img()) => markCoverDrawn(currentCoverTimingId(), url, image, drawMs);

const lastCall = () => trackMock.mock.calls.at(-1) as [string, Record<string, unknown>] | undefined;
const lastProps = () => lastCall()?.[1];

beforeEach(() => {
    vi.useFakeTimers();
    // 빠른 경우에도 표본으로 뽑히게 한다
    vi.spyOn(Math, 'random').mockReturnValue(0);
    trackMock.mockClear();
});

afterEach(() => {
    endCoverTiming();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('coverTiming', () => {
    it('조회 결과 개수가 세션의 여행 수와 다르면(직전 링의 결과) 무시한다', () => {
        beginCoverTiming(2);
        markRingBuilt();
        markCoversResolved(['old'], [1], [true]);
        expect(trackMock).not.toHaveBeenCalled();
        markCoversResolved([undefined, undefined], [0, 0], [true, true]);
        expect(lastProps()).toMatchObject({ end_reason: 'complete', expected_covers: 0 });
    });

    it('카드 생성·API 완료·모든 커버 렌더가 끝나면 ticket_cover_timing으로 단계별 시각을 보낸다', () => {
        beginCoverTiming(2);
        vi.advanceTimersByTime(100);
        markRingBuilt();
        vi.advanceTimersByTime(400);
        markCoversResolved(['a', 'b'], [3, 5], [true, true]);
        vi.advanceTimersByTime(300);
        const renderA = draw('a', 12);
        const renderB = draw('b', 40, img(1200, 900));
        vi.advanceTimersByTime(16);
        renderA?.();
        expect(trackMock).not.toHaveBeenCalled();
        renderB?.();

        expect(trackMock).toHaveBeenCalledTimes(1);
        expect(lastCall()?.[0]).toBe('ticket_cover_timing');
        expect(lastProps()).toMatchObject({
            end_reason: 'complete',
            trip_count: 2,
            expected_covers: 2,
            rendered_covers: 2,
            api_failed_count: 0,
            ring_built_ms: 100,
            api_ms: 500,
            first_cover_ms: 800,
            last_cover_rendered_ms: 816,
            max_draw_ms: 40,
            max_width: 4000,
            sampled: true,
        });
    });

    it('조회가 다 끝나기 전에는 API 완료로 보지 않고, 먼저 렌더된 커버(캐시 적중)도 센다', () => {
        beginCoverTiming(2);
        markRingBuilt();
        markCoversResolved(['a', undefined], [3, null], [true, false]);
        draw('a')?.();
        expect(trackMock).not.toHaveBeenCalled();

        markCoversResolved(['a', undefined], [3, 0], [true, true]);
        expect(lastProps()).toMatchObject({ end_reason: 'complete', expected_covers: 1, rendered_covers: 1 });
    });

    it('여러 카드가 같은 커버를 써도 카드마다 렌더될 때까지 기다린다', () => {
        beginCoverTiming(2);
        markRingBuilt();
        markCoversResolved(['same', 'same'], [1, 1], [true, true]);
        draw('same')?.();
        expect(trackMock).not.toHaveBeenCalled();
        draw('same')?.();
        expect(lastProps()).toMatchObject({ end_reason: 'complete', rendered_covers: 2 });
    });

    it('조회가 실패하면 timeout이 아니라 실패 수를 담아 바로 끝낸다', () => {
        beginCoverTiming(2);
        markRingBuilt();
        markCoversResolved([undefined, 'b'], [null, 2], [true, true]);
        draw('b')?.();
        expect(lastProps()).toMatchObject({ end_reason: 'complete', api_failed_count: 1, expected_covers: 1 });
    });

    it('사진이 없어도 카드가 만들어질 때까지 기다려 카드 생성 시간을 남긴다', () => {
        beginCoverTiming(1);
        markCoversResolved([undefined], [0], [true]);
        expect(trackMock).not.toHaveBeenCalled();

        vi.advanceTimersByTime(250);
        markRingBuilt();
        expect(lastProps()).toMatchObject({ end_reason: 'complete', expected_covers: 0, ring_built_ms: 250 });
    });

    it('그리기만 하고 렌더되지 않은 커버는 완료로 세지 않는다(입장 지연 중)', () => {
        beginCoverTiming(1);
        markRingBuilt();
        markCoversResolved(['a'], [1], [true]);
        const onRendered = draw('a');
        vi.advanceTimersByTime(500);
        expect(trackMock).not.toHaveBeenCalled();
        onRendered?.();
        expect(lastProps()).toMatchObject({ end_reason: 'complete', last_cover_rendered_ms: 500 });
    });

    it('커버가 끝내 렌더되지 않으면 timeout으로, 표본과 무관하게 보낸다', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        beginCoverTiming(1);
        markRingBuilt();
        markCoversResolved(['a'], [1], [true]);
        vi.advanceTimersByTime(15_000);
        expect(lastCall()?.[0]).toBe('ticket_cover_timing');
        expect(lastProps()).toMatchObject({
            end_reason: 'timeout',
            expected_covers: 1,
            rendered_covers: 0,
            sampled: false,
        });
    });

    it('빠르게 끝난 세션은 표본에 뽑히지 않으면 보내지 않는다', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        beginCoverTiming(1);
        markRingBuilt();
        markCoversResolved([undefined], [0], [true]);
        expect(trackMock).not.toHaveBeenCalled();
    });

    it('링을 닫으면 closed로 끝나고 이후 호출은 무시된다', () => {
        beginCoverTiming(1);
        vi.advanceTimersByTime(2000);
        endCoverTiming();
        expect(lastProps()).toMatchObject({ end_reason: 'closed', api_ms: null, sampled: false });

        markRingBuilt();
        markCoversResolved(['a'], [1], [true]);
        expect(draw('a')).toBeNull();
        vi.advanceTimersByTime(20_000);
        expect(trackMock).toHaveBeenCalledTimes(1);
    });

    it('이전 링 카드의 늦은 커버는 새 세션에 섞이지 않는다', () => {
        beginCoverTiming(1);
        const oldCardId = currentCoverTimingId();
        markRingBuilt();
        markCoversResolved(['old'], [1], [true]);
        const oldRendered = markCoverDrawn(oldCardId, 'old', img(), 1);

        beginCoverTiming(1);
        expect(lastProps()).toMatchObject({ end_reason: 'closed' });
        markRingBuilt();
        markCoversResolved(['new'], [1], [true]);

        // 이전 카드의 렌더 콜백과 새로 그린 이전 카드 커버는 모두 무시된다
        oldRendered?.();
        expect(markCoverDrawn(oldCardId, 'old', img(), 1)).toBeNull();
        expect(trackMock).toHaveBeenCalledTimes(1);

        draw('new')?.();
        expect(trackMock).toHaveBeenCalledTimes(2);
        expect(lastProps()).toMatchObject({ end_reason: 'complete', rendered_covers: 1 });
    });
});
