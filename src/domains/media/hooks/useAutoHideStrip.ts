import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAutoHideStripReturn {
    shown: boolean;
    notifyActivity: () => void;
}

export const useAutoHideStrip = (triggerKey: number | string, hideAfterMs = 3000): UseAutoHideStripReturn => {
    const [shown, setShown] = useState(true);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const startHideTimer = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setShown(false), hideAfterMs);
    }, [hideAfterMs]);

    useEffect(() => {
        setShown(true);
        startHideTimer();
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [triggerKey, startHideTimer]);

    const notifyActivity = useCallback(() => {
        setShown(true);
        startHideTimer();
    }, [startHideTimer]);

    return { shown, notifyActivity };
};
