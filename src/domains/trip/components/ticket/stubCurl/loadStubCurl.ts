// 메인 번들에 들어가는 파일이라 three를 직접 import하지 않는다
type StubCurlModule = typeof import('./curl');

export const CURL_LOAD_BUDGET_MS = 150;
const IDLE_PREFETCH_TIMEOUT_MS = 3000;
const FALLBACK_PREFETCH_DELAY_MS = 1200;

let stubCurlModule: Promise<StubCurlModule> | null = null;

export const loadStubCurl = () => {
    stubCurlModule ??= import('./curl').catch((error) => {
        stubCurlModule = null;
        throw error;
    });
    return stubCurlModule;
};

export const withinBudget = <T>(promise: Promise<T>, budgetMs: number): Promise<T | null> =>
    new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), budgetMs);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            () => {
                clearTimeout(timer);
                resolve(null);
            },
        );
    });

export const prefersReducedMotion = () =>
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export type CurlTapAction = 'ignore' | 'navigate' | 'curl';

interface CurlTapState {
    isPlaying: boolean;
    isReducedMotion: boolean;
    hasStub: boolean;
}

export const decideCurlTap = ({ isPlaying, isReducedMotion, hasStub }: CurlTapState): CurlTapAction => {
    if (isPlaying) return 'ignore';
    if (isReducedMotion || !hasStub) return 'navigate';
    return 'curl';
};

/** 반환값은 예약 취소 함수 */
export const prefetchStubCurl = () => {
    if (prefersReducedMotion()) return () => {};
    const load = () => {
        loadStubCurl().catch(() => {});
    };
    if (typeof window.requestIdleCallback === 'function') {
        const idleId = window.requestIdleCallback(load, { timeout: IDLE_PREFETCH_TIMEOUT_MS });
        return () => window.cancelIdleCallback(idleId);
    }
    const timeoutId = window.setTimeout(load, FALLBACK_PREFETCH_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
};
