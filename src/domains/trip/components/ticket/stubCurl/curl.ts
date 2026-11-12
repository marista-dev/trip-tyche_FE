/**
 * 지연 로드 청크의 입구. three.js는 이 파일을 통해서만 들어온다.
 */
import { bakeStub, isTainted, loadCorsImage } from './bakeStub';
import { CURL } from './curlMath';
import { createCurlScene } from './engine';
import { setStubTorn } from './stubTorn';

export interface PlayStubCurlOptions {
    signal?: AbortSignal;
    /** 사진을 CORS로 다시 받는 데 기다릴 최대 시간. 넘기면 사진 없이 굽는다 */
    photoTimeoutMs?: number;
}

/** rAF가 멈춰도(백그라운드 탭) 사용자가 갇히지 않도록 */
const SAFETY_MS = CURL.endMs + 700;

/**
 * 옆면을 WebGL 조각으로 바꿔치기해 말아 떨어뜨린다.
 * 다 떨어지면 resolve. 옆면은 찢긴 상태로 남겨 둔다 — 이동 직전 깜빡이지 않게(복구는 호출부 몫).
 * WebGL·굽기 실패는 reject. signal이 abort되면 즉시 정리하고 resolve.
 */
export const playStubCurl = async (stub: HTMLElement, { signal, photoTimeoutMs = 120 }: PlayStubCurlOptions = {}) => {
    const photoEl = stub.parentElement?.querySelector('img');
    const photo = await loadCorsImage(photoEl?.currentSrc || photoEl?.src, photoTimeoutMs);
    if (signal?.aborted) return;

    let baked = bakeStub(stub, photo);
    // crossOrigin 이미지면 오염되지 않지만, 혹시 오염됐으면 사진 없이 다시 굽는다
    if (photo && isTainted(baked.canvas)) baked = bakeStub(stub, null);

    return new Promise<void>((resolve, reject) => {
        let raf = 0;
        let start = 0;
        let settled = false;
        let scene: ReturnType<typeof createCurlScene> | null = null;

        const finish = (error?: unknown) => {
            if (settled) return;
            settled = true;
            cancelAnimationFrame(raf);
            clearTimeout(safety);
            signal?.removeEventListener('abort', onAbort);
            window.removeEventListener('scroll', onMove, true);
            window.removeEventListener('resize', onMove);
            scene?.dispose();
            if (error) reject(error);
            else resolve();
        };
        const onAbort = () => finish();
        // 캔버스는 탭 순간 위치에 고정돼 있어, 스크롤·회전하면 조각이 티켓에서 떨어져 보인다 — 효과를 접고 바로 이동한다
        const onMove = () => finish();
        const safety = setTimeout(() => finish(), SAFETY_MS);

        try {
            scene = createCurlScene(stub.getBoundingClientRect(), baked, () => finish(new Error('WebGL context lost')));
        } catch (error) {
            finish(error);
            return;
        }
        signal?.addEventListener('abort', onAbort);
        window.addEventListener('scroll', onMove, { capture: true, passive: true });
        window.addEventListener('resize', onMove);

        const tick = (now: number) => {
            try {
                if (!start) {
                    start = now;
                    // 첫 프레임(평평한 조각)과 같은 프레임에 HTML 옆면을 숨긴다 → 바꿔치기가 보이지 않는다
                    scene!.render(0);
                    setStubTorn(stub, true);
                } else {
                    const t = now - start;
                    if (t >= CURL.endMs) {
                        finish();
                        return;
                    }
                    scene!.render(t);
                }
                raf = requestAnimationFrame(tick);
            } catch (error) {
                finish(error);
            }
        };
        raf = requestAnimationFrame(tick);
    });
};
