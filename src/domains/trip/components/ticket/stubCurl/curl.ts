// 지연 로드 청크의 입구 — three.js는 이 파일을 통해서만 들어온다
import { bakeStub } from './bakeStub';
import { isCanvasTainted, loadCorsImage } from './corsImage';
import { CURL } from './curlMath';
import { createCurlScene } from './engine';
import { setStubTorn } from './stubTorn';

export interface PlayStubCurlOptions {
    signal?: AbortSignal;
    /** 넘기면 사진 없이 굽는다 */
    photoTimeoutMs?: number;
}

const DEFAULT_PHOTO_TIMEOUT_MS = 120;
/** rAF가 멈춰도(백그라운드 탭) 사용자가 갇히지 않게 */
const SAFETY_TIMEOUT_MS = CURL.endMs + 700;

/**
 * 다 떨어지면 resolve하고 옆면은 찢긴 상태로 둔다 — 이동 직전 깜빡이지 않게(복구는 호출부 몫).
 * WebGL·굽기 실패는 reject, abort되면 정리 후 resolve.
 */
export const playStubCurl = async (
    stub: HTMLElement,
    { signal, photoTimeoutMs = DEFAULT_PHOTO_TIMEOUT_MS }: PlayStubCurlOptions = {},
) => {
    const photoElement = stub.parentElement?.querySelector('img');
    const photo = await loadCorsImage(photoElement?.currentSrc || photoElement?.src, photoTimeoutMs);
    if (signal?.aborted) return;

    let baked = bakeStub(stub, photo);
    if (photo && isCanvasTainted(baked.front)) baked = bakeStub(stub, null);

    return new Promise<void>((resolve, reject) => {
        let frameId = 0;
        let startedAt = 0;
        let isSettled = false;
        let scene: ReturnType<typeof createCurlScene> | null = null;

        const finish = (error?: unknown) => {
            if (isSettled) return;
            isSettled = true;
            cancelAnimationFrame(frameId);
            clearTimeout(safetyTimer);
            signal?.removeEventListener('abort', handleAbort);
            window.removeEventListener('scroll', handleViewportChange, true);
            window.removeEventListener('resize', handleViewportChange);
            scene?.dispose();
            if (error) reject(error);
            else resolve();
        };
        const handleAbort = () => finish();
        // 캔버스는 탭 순간 위치에 고정돼 있어 스크롤·회전하면 조각이 티켓에서 떨어져 보인다
        const handleViewportChange = () => finish();
        const safetyTimer = setTimeout(() => finish(), SAFETY_TIMEOUT_MS);

        try {
            scene = createCurlScene(stub.getBoundingClientRect(), baked, () => finish(new Error('WebGL context lost')));
        } catch (error) {
            finish(error);
            return;
        }
        signal?.addEventListener('abort', handleAbort);
        window.addEventListener('scroll', handleViewportChange, { capture: true, passive: true });
        window.addEventListener('resize', handleViewportChange);

        const renderFrame = (now: number) => {
            try {
                if (!startedAt) {
                    startedAt = now;
                    // 평평한 첫 프레임과 같은 프레임에 HTML 옆면을 숨겨야 바꿔치기가 보이지 않는다
                    scene!.render(0);
                    setStubTorn(stub, true);
                } else {
                    const elapsedMs = now - startedAt;
                    if (elapsedMs >= CURL.endMs) {
                        finish();
                        return;
                    }
                    scene!.render(elapsedMs);
                }
                frameId = requestAnimationFrame(renderFrame);
            } catch (error) {
                finish(error);
            }
        };
        frameId = requestAnimationFrame(renderFrame);
    });
};
