import { useCallback, useRef, useState } from 'react';

const DOUBLE_TAP_THRESHOLD_MS = 320;
const ZOOM_OUT = 1;
const ZOOM_IN = 2.2;

interface UseDoubleTapZoomReturn {
    zoom: number;
    handleTap: () => void;
    resetZoom: () => void;
}

export const useDoubleTapZoom = (onZoomChange?: (zoom: number) => void): UseDoubleTapZoomReturn => {
    const [zoom, setZoom] = useState<number>(ZOOM_OUT);
    const lastTapRef = useRef<number>(0);

    const handleTap = useCallback(() => {
        const now = Date.now();
        if (now - lastTapRef.current < DOUBLE_TAP_THRESHOLD_MS) {
            const nextZoom = zoom === ZOOM_OUT ? ZOOM_IN : ZOOM_OUT;
            setZoom(nextZoom);
            onZoomChange?.(nextZoom);
            lastTapRef.current = 0;
            return;
        }
        lastTapRef.current = now;
    }, [zoom, onZoomChange]);

    const resetZoom = useCallback(() => {
        if (zoom !== ZOOM_OUT) {
            setZoom(ZOOM_OUT);
            onZoomChange?.(ZOOM_OUT);
        }
    }, [zoom, onZoomChange]);

    return { zoom, handleTap, resetZoom };
};
