import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef } from 'react';

interface UseGestureRouterOptions {
    onSingleTap?: () => void;
    onDoubleTap?: () => void;
    onLongPress?: () => void;
    doubleTapWindowMs?: number;
    longPressMs?: number;
    moveTolerancePx?: number;
    enabled?: boolean;
}

interface GestureBindings {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
    reset: () => void;
}

export const useGestureRouter = ({
    onSingleTap,
    onDoubleTap,
    onLongPress,
    doubleTapWindowMs = 320,
    longPressMs = 350,
    moveTolerancePx = 10,
    enabled = true,
}: UseGestureRouterOptions): GestureBindings => {
    const callbacksRef = useRef({ onSingleTap, onDoubleTap, onLongPress });

    useEffect(() => {
        callbacksRef.current = { onSingleTap, onDoubleTap, onLongPress };
    }, [onSingleTap, onDoubleTap, onLongPress]);

    const downAtRef = useRef<{ x: number; y: number; time: number; id: number } | null>(null);
    const lastTapAtRef = useRef<number>(0);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressFiredRef = useRef<boolean>(false);
    const movedTooFarRef = useRef<boolean>(false);

    const clearLongPress = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }, []);

    const clearSingleTap = useCallback(() => {
        if (singleTapTimerRef.current) {
            clearTimeout(singleTapTimerRef.current);
            singleTapTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            clearLongPress();
            clearSingleTap();
        };
    }, [clearLongPress, clearSingleTap]);

    const onPointerDown = useCallback(
        (e: ReactPointerEvent<HTMLElement>) => {
            if (!enabled) return;
            downAtRef.current = {
                x: e.clientX,
                y: e.clientY,
                time: Date.now(),
                id: e.pointerId,
            };
            longPressFiredRef.current = false;
            movedTooFarRef.current = false;
            clearLongPress();
            longPressTimerRef.current = setTimeout(() => {
                longPressFiredRef.current = true;
                longPressTimerRef.current = null;
                callbacksRef.current.onLongPress?.();
            }, longPressMs);
        },
        [enabled, longPressMs, clearLongPress],
    );

    const onPointerMove = useCallback(
        (e: ReactPointerEvent<HTMLElement>) => {
            const down = downAtRef.current;
            if (!down || down.id !== e.pointerId) return;
            const dx = e.clientX - down.x;
            const dy = e.clientY - down.y;
            if (Math.hypot(dx, dy) > moveTolerancePx) {
                movedTooFarRef.current = true;
                clearLongPress();
                clearSingleTap();
                lastTapAtRef.current = 0;
            }
        },
        [moveTolerancePx, clearLongPress, clearSingleTap],
    );

    const onPointerUp = useCallback(
        (e: ReactPointerEvent<HTMLElement>) => {
            const down = downAtRef.current;
            if (!down || down.id !== e.pointerId) {
                clearLongPress();
                return;
            }
            clearLongPress();
            const wasLongPress = longPressFiredRef.current;
            const movedFar = movedTooFarRef.current;
            downAtRef.current = null;
            longPressFiredRef.current = false;
            movedTooFarRef.current = false;

            if (wasLongPress || movedFar) {
                lastTapAtRef.current = 0;
                return;
            }

            const now = Date.now();
            if (now - lastTapAtRef.current <= doubleTapWindowMs) {
                lastTapAtRef.current = 0;
                clearSingleTap();
                callbacksRef.current.onDoubleTap?.();
                return;
            }
            lastTapAtRef.current = now;
            clearSingleTap();
            singleTapTimerRef.current = setTimeout(() => {
                singleTapTimerRef.current = null;
                lastTapAtRef.current = 0;
                callbacksRef.current.onSingleTap?.();
            }, doubleTapWindowMs);
        },
        [doubleTapWindowMs, clearLongPress, clearSingleTap],
    );

    const onPointerCancel = useCallback(
        (_e: ReactPointerEvent<HTMLElement>) => {
            downAtRef.current = null;
            longPressFiredRef.current = false;
            movedTooFarRef.current = false;
            clearLongPress();
            clearSingleTap();
            lastTapAtRef.current = 0;
        },
        [clearLongPress, clearSingleTap],
    );

    const reset = useCallback(() => {
        downAtRef.current = null;
        longPressFiredRef.current = false;
        movedTooFarRef.current = false;
        clearLongPress();
        clearSingleTap();
        lastTapAtRef.current = 0;
    }, [clearLongPress, clearSingleTap]);

    return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, reset };
};
