import { useCallback, useEffect, useRef, useState } from 'react';

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
    const callbackRef = useRef(onZoomChange);

    useEffect(() => {
        callbackRef.current = onZoomChange;
    }, [onZoomChange]);

    const handleTap = useCallback(() => {
        const now = Date.now();
        if (now - lastTapRef.current < DOUBLE_TAP_THRESHOLD_MS) {
            setZoom((prev) => {
                const next = prev === ZOOM_OUT ? ZOOM_IN : ZOOM_OUT;
                callbackRef.current?.(next);
                return next;
            });
            lastTapRef.current = 0;
            return;
        }
        lastTapRef.current = now;
    }, []);

    const resetZoom = useCallback(() => {
        setZoom((prev) => {
            if (prev !== ZOOM_OUT) {
                callbackRef.current?.(ZOOM_OUT);
                return ZOOM_OUT;
            }
            return prev;
        });
    }, []);

    return { zoom, handleTap, resetZoom };
};
