/**
 * 말림 효과 청크(three.js 포함)를 메인 번들과 분리해 불러온다.
 * 이 파일은 메인 번들에 들어가므로 three를 직접 import하지 않는다.
 */
type StubCurlModule = typeof import('./curl');

/** 탭 후 청크를 기다릴 최대 시간. 넘기면 효과 없이 바로 이동 */
export const LOAD_BUDGET_MS = 150;

let pending: Promise<StubCurlModule> | null = null;

export const loadStubCurl = () => {
    pending ??= import('./curl').catch((error) => {
        pending = null; // 네트워크 실패면 다음 탭에서 다시 시도
        throw error;
    });
    return pending;
};

/** 시간 안에 끝나면 결과, 아니면 null. 실패도 null — 효과는 없어도 되는 장식이다 */
export const withinBudget = <T>(promise: Promise<T>, ms: number): Promise<T | null> =>
    new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), ms);
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

/** 탭을 어떻게 처리할지. 재생 중 탭은 무시, 모션 줄이기·옆면 없음은 바로 이동 */
export const decideCurlTap = ({
    playing,
    reducedMotion,
    hasStub,
}: {
    playing: boolean;
    reducedMotion: boolean;
    hasStub: boolean;
}): CurlTapAction => {
    if (playing) return 'ignore';
    if (reducedMotion || !hasStub) return 'navigate';
    return 'curl';
};

/** 유휴 시간에 청크를 미리 받는다. 반환값은 예약 취소 함수 */
export const prefetchStubCurl = () => {
    if (prefersReducedMotion()) return () => {};
    const run = () => {
        loadStubCurl().catch(() => {});
    };
    if (typeof window.requestIdleCallback === 'function') {
        const id = window.requestIdleCallback(run, { timeout: 3000 });
        return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 1200);
    return () => window.clearTimeout(id);
};
