import { ANALYTICS_EVENTS, track } from './analytics';

/*
 * 성능 진단용 계측. 동작은 바꾸지 않고 시각만 남긴다.
 *
 * - perfMark: DevTools Performance 패널의 Timings 트랙에 표시가 찍힌다(항상 켜져 있고 비용이 거의 없다).
 * - perfLog: 개발 서버이거나 localStorage에 `triptyche.perf=1`이 있을 때만 콘솔에 출력한다.
 *   에뮬레이터·운영 빌드에서도 chrome://inspect 콘솔에서 위 값을 넣고 새로고침하면 볼 수 있다.
 * - watchWebGLContext: WebGL 컨텍스트 손실을 PostHog로 보낸다. 검은 화면의 원인을 기기 데이터로 확인하려는 용도다.
 */

const PERF_FLAG_KEY = 'triptyche.perf';

const logEnabled = (() => {
    if (import.meta.env.DEV) return true;
    try {
        return localStorage.getItem(PERF_FLAG_KEY) === '1';
    } catch {
        return false;
    }
})();

export const perfNow = () => performance.now();

export const perfMark = (name: string) => {
    try {
        performance.mark(name);
    } catch {
        // User Timing을 못 쓰는 환경이면 표시만 빠진다.
    }
};

/** 조건에 맞는 표시를 지운다. 링을 반복해서 열어도 타임라인 버퍼가 계속 커지지 않게 한다 */
export const perfClearMarks = (match: (name: string) => boolean) => {
    try {
        performance
            .getEntriesByType('mark')
            .filter((entry) => match(entry.name))
            .forEach((entry) => performance.clearMarks(entry.name));
    } catch {
        // User Timing을 못 쓰는 환경이면 지울 것도 없다.
    }
};

export const perfLog = (label: string, data: Record<string, unknown> | Record<string, unknown>[]) => {
    if (!logEnabled) return;
    /* eslint-disable no-console -- 진단 출력이 이 함수의 목적이다. 개발 서버나 플래그가 켜졌을 때만 나간다 */
    console.groupCollapsed(`[perf] ${label}`);
    console.table(data);
    console.groupEnd();
    /* eslint-enable no-console */
};

/* ─── 화면 가시성 ──────────────────────────────────────────
 * 컨텍스트 손실이 "백그라운드 갔다 복귀"한 직후인지 구분하려고 마지막 가시성 변화 시각을 기억한다. */
let lastVisibilityChangeAt = 0;
let visibilityWatched = false;
const watchVisibility = () => {
    if (visibilityWatched) return;
    visibilityWatched = true;
    document.addEventListener('visibilitychange', () => {
        lastVisibilityChangeAt = perfNow();
    });
};

type WebGLScene = 'globe' | 'map';

interface NavigatorWithMemory extends Navigator {
    deviceMemory?: number;
}

const environmentProps = () => ({
    device_memory_gb: (navigator as NavigatorWithMemory).deviceMemory ?? null,
    hardware_concurrency: navigator.hardwareConcurrency ?? null,
    dpr: window.devicePixelRatio,
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
});

/**
 * target 아래 canvas의 webglcontextlost/restored를 capture 단계로 감지한다.
 * 이 이벤트는 bubble되지 않지만 capture로는 조상에서 잡힌다 — Google Maps처럼 내부 canvas에 접근할 수 없어도 컨테이너에 달면 된다.
 * 감지만 하고 preventDefault는 하지 않는다(three.js·Google Maps의 자체 복구 동작을 바꾸지 않는다).
 * 반환한 함수로 떼어 낸다. 페이지를 떠나며 일부러 컨텍스트를 반납(forceContextLoss)하기 전에 먼저 떼야 오탐이 없다.
 */
export const watchWebGLContext = (target: EventTarget, scene: WebGLScene): (() => void) => {
    watchVisibility();
    const attachedAt = perfNow();
    let lostAt: number | null = null;

    const onLost = () => {
        const now = perfNow();
        lostAt = now;
        const props = {
            scene,
            uptime_ms: Math.round(now - attachedAt),
            visibility: document.visibilityState,
            ms_since_visibility_change: lastVisibilityChangeAt ? Math.round(now - lastVisibilityChangeAt) : null,
            ...environmentProps(),
        };
        perfMark(`webgl:${scene}:lost`);
        perfLog(`webgl context lost (${scene})`, props);
        track(ANALYTICS_EVENTS.WEBGL_CONTEXT_LOST, props);
    };

    const onRestored = () => {
        const props = {
            scene,
            lost_for_ms: lostAt === null ? null : Math.round(perfNow() - lostAt),
        };
        lostAt = null;
        perfMark(`webgl:${scene}:restored`);
        perfLog(`webgl context restored (${scene})`, props);
        track(ANALYTICS_EVENTS.WEBGL_CONTEXT_RESTORED, props);
    };

    target.addEventListener('webglcontextlost', onLost, true);
    target.addEventListener('webglcontextrestored', onRestored, true);
    return () => {
        target.removeEventListener('webglcontextlost', onLost, true);
        target.removeEventListener('webglcontextrestored', onRestored, true);
    };
};
