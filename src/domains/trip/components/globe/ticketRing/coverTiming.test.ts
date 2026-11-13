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
}));

const { beginCoverTiming, endCoverTiming, markCoverDrawn, markCoversResolved, markRingBuilt } = await import(
    './coverTiming'
);

const img = (w = 4000, h = 3000) => ({ naturalWidth: w, naturalHeight: h }) as HTMLImageElement;

/** rAF 콜백을 직접 돌린다(텍스처 업로드 이후 프레임) */
const frames: FrameRequestCallback[] = [];
const flushFrame = () => frames.splice(0).forEach((cb) => cb(0));

const lastProps = () => trackMock.mock.calls.at(-1)?.[1] as Record<string, unknown>;

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    // 빠른 경우에도 표본으로 뽑히게 한다
    vi.spyOn(Math, 'random').mockReturnValue(0);
    trackMock.mockClear();
    frames.length = 0;
});

afterEach(() => {
    endCoverTiming();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('coverTiming', () => {
    it('API 응답 후 모든 커버가 GPU에 올라가면 complete로 단계별 시각을 보낸다', () => {
        beginCoverTiming(2);
        vi.advanceTimersByTime(100);
        markRingBuilt();
        vi.advanceTimersByTime(400);
        markCoversResolved(['a', 'b'], [3, 5]);
        vi.advanceTimersByTime(300);
        markCoverDrawn('a', img(), 12);
        markCoverDrawn('b', img(1200, 900), 40);
        expect(trackMock).not.toHaveBeenCalled();
        vi.advanceTimersByTime(16);
        flushFrame();

        expect(trackMock).toHaveBeenCalledTimes(1);
        expect(lastProps()).toMatchObject({
            end_reason: 'complete',
            trip_count: 2,
            cover_count: 2,
            ring_built_ms: 100,
            api_ms: 500,
            first_cover_ms: 800,
            last_cover_on_gpu_ms: 816,
            max_draw_ms: 40,
            max_width: 4000,
            sampled: true,
        });
    });

    it('사진 수가 아직 모르는 여행이 있으면 API 완료로 보지 않는다', () => {
        beginCoverTiming(2);
        markCoversResolved(['a', undefined], [3, null]);
        markCoverDrawn('a', img(), 1);
        flushFrame();
        expect(trackMock).not.toHaveBeenCalled();

        markCoversResolved(['a', undefined], [3, 0]);
        // a는 이미 그려졌고 둘째 여행은 사진이 없다 → 기다릴 것이 없다
        expect(lastProps()).toMatchObject({ end_reason: 'complete', cover_count: 1 });
    });

    it('사진이 하나도 없으면 API 완료 시점에 바로 끝난다', () => {
        beginCoverTiming(1);
        markCoversResolved([undefined], [0]);
        expect(lastProps()).toMatchObject({ end_reason: 'complete', cover_count: 0 });
    });

    it('커버가 끝내 그려지지 않으면 timeout으로, 표본과 무관하게 보낸다', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        beginCoverTiming(1);
        markCoversResolved(['a'], [1]);
        vi.advanceTimersByTime(15_000);
        expect(lastProps()).toMatchObject({ end_reason: 'timeout', pending_count: 1, sampled: false });
    });

    it('빠르게 끝난 세션은 표본에 뽑히지 않으면 보내지 않는다', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        beginCoverTiming(1);
        markCoversResolved([undefined], [0]);
        expect(trackMock).not.toHaveBeenCalled();
    });

    it('링을 닫으면 closed로 끝나고 이후 호출은 무시된다', () => {
        beginCoverTiming(1);
        vi.advanceTimersByTime(2000);
        endCoverTiming();
        expect(lastProps()).toMatchObject({ end_reason: 'closed', api_ms: null, sampled: false });

        markCoversResolved(['a'], [1]);
        markCoverDrawn('a', img(), 1);
        flushFrame();
        vi.advanceTimersByTime(20_000);
        expect(trackMock).toHaveBeenCalledTimes(1);
    });

    it('새 핀을 탭하면 이전 세션은 closed로 끝나고 늦게 온 프레임은 새 세션에 섞이지 않는다', () => {
        beginCoverTiming(1);
        markCoversResolved(['a'], [1]);
        markCoverDrawn('a', img(), 1);
        beginCoverTiming(1);
        expect(lastProps()).toMatchObject({ end_reason: 'closed' });

        flushFrame();
        expect(trackMock).toHaveBeenCalledTimes(1);
    });
});
