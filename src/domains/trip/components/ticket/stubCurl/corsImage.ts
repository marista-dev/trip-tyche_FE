/** 실패·시간 초과면 null */
export const loadCorsImage = (src: string | undefined, timeoutMs: number): Promise<HTMLImageElement | null> => {
    if (!src) return Promise.resolve(null);
    return new Promise((resolve) => {
        const image = new Image();
        const timer = setTimeout(() => resolve(null), timeoutMs);
        image.crossOrigin = 'anonymous';
        image.decoding = 'async';
        image.onload = () => {
            clearTimeout(timer);
            resolve(image);
        };
        image.onerror = () => {
            clearTimeout(timer);
            resolve(null);
        };
        image.src = src;
    });
};

/** 교차 출처 이미지로 오염된 캔버스는 WebGL 업로드에서 SecurityError를 던진다 */
export const isCanvasTainted = (canvas: HTMLCanvasElement) => {
    try {
        canvas.getContext('2d')!.getImageData(0, 0, 1, 1);
        return false;
    } catch {
        return true;
    }
};
