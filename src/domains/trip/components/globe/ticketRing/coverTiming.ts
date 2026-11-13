import type { LoadedCover } from './ticketCard';
import { ANALYTICS_EVENTS, track } from '@/libs/analytics';
import { perfClearMarks, perfLog, perfMark, perfNow } from '@/libs/perf';

/*
 * 핀 탭 → 티켓 링 커버 사진이 다 보일 때까지의 구간 측정.
 * 링을 한 번 열 때마다 세션 하나를 만들고, 단계마다 시각을 남겼다가 끝나면 콘솔(perfLog)과 PostHog로 보낸다.
 *
 *   pin-tap ─ built(폰트 대기 후 카드 생성) ─ covers-api(사진 목록 응답) ─ cover-drawn(사진을 앞면에 그림) ─ cover-rendered(그 카드가 실제로 렌더됨)
 *
 * 완료 조건: 카드 생성 + API 완료 + 커버가 있는 카드 수만큼 렌더 완료.
 * 커버는 URL이 아니라 카드 단위로 센다 — 여러 카드가 같은 사진을 써도 각 카드가 렌더될 때까지 기다린다.
 *
 * 동작에는 관여하지 않는다. 세션이 없거나 id가 다르면(링이 닫혔거나 다른 링이 열렸으면) 모든 함수가 아무것도 하지 않는다.
 */

/** 이보다 오래 걸리면 끝까지 기다리지 않고 timeout으로 보낸다 */
const SESSION_TIMEOUT_MS = 15_000;
/** 이 이상이면 느린 것으로 보고 항상 보낸다. 그보다 빠르면 표본만 보낸다 */
const SLOW_MS = 1500;
const FAST_SAMPLE_RATE = 0.1;

interface CoverSample {
    /** 핀 탭부터 앞면에 그릴 때까지 */
    drawn_at_ms: number;
    /** 핀 탭부터 그 카드가 실제로 렌더될 때까지(텍스처 업로드 포함) */
    rendered_at_ms: number | null;
    /** drawImage 포함 앞면 캔버스 그리기(<img> 대체 경로면 동기 디코딩 포함) */
    draw_ms: number;
    /** 앞면에 그린 이미지 크기. 비트맵 경로면 줄인 뒤 크기다 */
    width: number;
    height: number;
    /** Resource Timing의 다운로드 시간. 캐시 적중이면 0에 가깝다 */
    download_ms: number | null;
    /** 받은 파일 크기(blob.size). <img> 대체 경로면 null */
    bytes: number | null;
    /** <img> 대체 경로로 받았는지 */
    fallback: boolean;
}

interface Session {
    id: number;
    startedAt: number;
    tripCount: number;
    ringBuiltAt: number | null;
    apiDoneAt: number | null;
    /** 조회가 실패한 여행 수. API 완료 전이면 null */
    apiFailedCount: number | null;
    /** 커버를 그려야 할 카드 수. API 완료 전이면 null */
    expectedCovers: number | null;
    renderedCovers: number;
    covers: CoverSample[];
    timer: ReturnType<typeof setTimeout>;
}

type EndReason = 'complete' | 'closed' | 'timeout';

let session: Session | null = null;
let nextId = 1;

const since = (s: Session, at: number | null) => (at === null ? null : Math.round(at - s.startedAt));

const resourceTiming = (url: string) => {
    const entry = performance.getEntriesByName(url, 'resource').at(-1) as PerformanceResourceTiming | undefined;
    return { download_ms: entry ? Math.round(entry.duration) : null };
};

const finish = (reason: EndReason) => {
    const s = session;
    if (!s) return;
    session = null;
    clearTimeout(s.timer);

    const totalMs = Math.round(perfNow() - s.startedAt);
    const { covers } = s;
    const max = (pick: (c: CoverSample) => number | null) =>
        covers.reduce<number | null>((m, c) => {
            const v = pick(c);
            return v === null ? m : Math.max(m ?? 0, v);
        }, null);

    const props = {
        end_reason: reason,
        trip_count: s.tripCount,
        expected_covers: s.expectedCovers,
        rendered_covers: s.renderedCovers,
        api_failed_count: s.apiFailedCount,
        total_ms: totalMs,
        ring_built_ms: since(s, s.ringBuiltAt),
        api_ms: since(s, s.apiDoneAt),
        first_cover_ms: covers.length ? Math.min(...covers.map((c) => c.drawn_at_ms)) : null,
        last_cover_rendered_ms: max((c) => c.rendered_at_ms),
        max_draw_ms: max((c) => c.draw_ms),
        max_download_ms: max((c) => c.download_ms),
        max_width: max((c) => c.width),
        max_height: max((c) => c.height),
        max_bytes: max((c) => c.bytes),
        fallback_count: covers.filter((c) => c.fallback).length,
    };

    perfMark(`ring:${s.id}:end`);
    perfLog(`ticket cover timing #${s.id} (${reason})`, props);
    if (covers.length) perfLog(`ticket covers #${s.id}`, covers as unknown as Record<string, unknown>[]);

    const slow = reason === 'timeout' || totalMs >= SLOW_MS;
    if (slow || Math.random() < FAST_SAMPLE_RATE) {
        track(ANALYTICS_EVENTS.TICKET_COVER_TIMING, { ...props, sampled: !slow });
    }
};

const completeIfDone = (s: Session) => {
    if (s.ringBuiltAt === null || s.expectedCovers === null) return;
    if (s.renderedCovers >= s.expectedCovers) finish('complete');
};

/** 핀을 탭해 링을 열 때. 이전 세션이 남아 있으면 closed로 끝내고, 그 세션의 타임라인 표시는 지운다 */
export const beginCoverTiming = (tripCount: number) => {
    if (session) finish('closed');
    // 링을 열 때마다 표시가 쌓이지 않게 한다. 직전 세션 것은 남겨 두어 DevTools에서 볼 수 있게 한다
    perfClearMarks((name) => /^ring:\d+:/.test(name) && !name.startsWith(`ring:${nextId - 1}:`));
    const id = nextId++;
    perfMark(`ring:${id}:pin-tap`);
    session = {
        id,
        startedAt: perfNow(),
        tripCount,
        ringBuiltAt: null,
        apiDoneAt: null,
        apiFailedCount: null,
        expectedCovers: null,
        renderedCovers: 0,
        covers: [],
        timer: setTimeout(() => finish('timeout'), SESSION_TIMEOUT_MS),
    };
};

/** 진행 중인 세션 id(없으면 0). 카드가 만들어질 때 기억해 두었다가 markCoverDrawn에 넘긴다 */
export const currentCoverTimingId = () => session?.id ?? 0;

/** 폰트를 기다린 뒤 카드를 만들었을 때 */
export const markRingBuilt = () => {
    const s = session;
    if (!s || s.ringBuiltAt !== null) return;
    s.ringBuiltAt = perfNow();
    perfMark(`ring:${s.id}:built`);
    completeIfDone(s);
};

/**
 * 커버 조회 결과가 바뀔 때마다 부른다. 모든 조회가 끝났을 때(성공·실패 무관) 한 번만 API 완료로 본다.
 * @param settled 여행별 조회 종료 여부
 * @param photoCounts 여행별 사진 수. 조회가 끝났는데 null이면 실패
 */
export const markCoversResolved = (
    coverUrls: (string | undefined)[],
    photoCounts: (number | null)[],
    settled: boolean[],
) => {
    const s = session;
    if (!s || s.apiDoneAt !== null) return;
    // 개수가 다르면 직전 링의 결과다(새 링의 조회 결과가 아직 반영되지 않은 렌더)
    if (settled.length !== s.tripCount || settled.some((done) => !done)) return;
    s.apiDoneAt = perfNow();
    s.apiFailedCount = photoCounts.filter((c) => c === null).length;
    s.expectedCovers = coverUrls.filter(Boolean).length;
    perfMark(`ring:${s.id}:covers-api`);
    completeIfDone(s);
};

/**
 * 커버 사진을 티켓 앞면에 그린 직후.
 * 반환한 함수를 그 카드가 실제로 렌더된 뒤(three.js onAfterRender) 한 번 부른다. 세션이 다르면 null.
 * 카드는 입장 애니메이션 지연 동안 보이지 않으므로 다음 프레임이 아니라 렌더 시점을 기다려야 텍스처 업로드까지 포함된다.
 */
export const markCoverDrawn = (
    timingId: number,
    url: string,
    cover: LoadedCover,
    drawMs: number,
): (() => void) | null => {
    const s = session;
    if (!s || s.id !== timingId) return null;
    const sample: CoverSample = {
        drawn_at_ms: Math.round(perfNow() - s.startedAt),
        rendered_at_ms: null,
        draw_ms: Math.round(drawMs * 10) / 10,
        width: cover.image.width,
        height: cover.image.height,
        bytes: cover.bytes,
        fallback: cover.bytes === null,
        ...resourceTiming(url),
    };
    s.covers.push(sample);
    perfMark(`ring:${s.id}:cover-drawn`);

    return () => {
        if (session !== s || sample.rendered_at_ms !== null) return;
        sample.rendered_at_ms = Math.round(perfNow() - s.startedAt);
        s.renderedCovers++;
        perfMark(`ring:${s.id}:cover-rendered`);
        completeIfDone(s);
    };
};

/** 링이 닫히거나 지구본을 떠날 때 */
export const endCoverTiming = () => finish('closed');
