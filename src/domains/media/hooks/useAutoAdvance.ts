import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAutoAdvanceReturn {
    index: number;
    progress: number;
    playing: boolean;
    setPlaying: (playing: boolean) => void;
    next: () => void;
    prev: () => void;
    goTo: (i: number) => void;
}

export const useAutoAdvance = (count: number, perPhotoMs = 5000): UseAutoAdvanceReturn => {
    const [index, setIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [playing, setPlaying] = useState(true);
    const rafRef = useRef<number | null>(null);
    const lastTRef = useRef<number | null>(null);

    useEffect(() => {
        if (!playing || count <= 1) {
            lastTRef.current = null;
            return;
        }

        const tick = (t: number) => {
            if (lastTRef.current === null) lastTRef.current = t;
            const dt = (t - lastTRef.current) / 1000;
            lastTRef.current = t;

            setProgress((p) => {
                const nextProgress = p + (dt * 1000) / perPhotoMs;
                if (nextProgress >= 1) {
                    setIndex((i) => {
                        if (i < count - 1) return i + 1;
                        setPlaying(false);
                        return i;
                    });
                    return 0;
                }
                return nextProgress;
            });

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            lastTRef.current = null;
        };
    }, [playing, perPhotoMs, count]);

    const next = useCallback(() => {
        setIndex((i) => {
            if (i < count - 1) {
                setProgress(0);
                return i + 1;
            }
            return i;
        });
    }, [count]);

    const prev = useCallback(() => {
        setIndex((i) => {
            if (i > 0) {
                setProgress(0);
                return i - 1;
            }
            return i;
        });
    }, []);

    const goTo = useCallback((i: number) => {
        setIndex(i);
        setProgress(0);
    }, []);

    return { index, progress, playing, setPlaying, next, prev, goTo };
};
