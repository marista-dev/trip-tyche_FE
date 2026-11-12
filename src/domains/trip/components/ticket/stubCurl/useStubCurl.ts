import { useCallback, useEffect, useRef } from 'react';

import { CURL_LOAD_BUDGET_MS, decideCurlTap, loadStubCurl, prefersReducedMotion, withinBudget } from './loadStubCurl';
import { setStubTorn } from './stubTorn';

const RESTORE_IF_STAYED_MS = 1500;
const MIN_PHOTO_WAIT_MS = 60;

export const useStubCurl = () => {
    const stubRef = useRef<HTMLDivElement>(null);
    const isPlayingRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const tornStubRef = useRef<HTMLElement | null>(null);
    const restoreTimerRef = useRef<number>();

    useEffect(
        () => () => {
            abortControllerRef.current?.abort();
            window.clearTimeout(restoreTimerRef.current);
            if (tornStubRef.current) setStubTorn(tornStubRef.current, false);
        },
        [],
    );

    const play = useCallback(async (onComplete: () => void) => {
        const stub = stubRef.current;
        const action = decideCurlTap({
            isPlaying: isPlayingRef.current,
            isReducedMotion: prefersReducedMotion(),
            hasStub: !!stub,
        });
        if (action === 'ignore') return;

        // 바로 이동하는 경우에도 잠근다 — 연타가 라우트를 두 번 밀어 넣지 않게
        isPlayingRef.current = true;
        const completeAndScheduleRestore = () => {
            onComplete();
            restoreTimerRef.current = window.setTimeout(() => {
                if (stub) setStubTorn(stub, false);
                isPlayingRef.current = false;
            }, RESTORE_IF_STAYED_MS);
        };

        if (action === 'navigate' || !stub) {
            completeAndScheduleRestore();
            return;
        }

        tornStubRef.current = stub;
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const tappedAt = performance.now();
        try {
            const curl = await withinBudget(loadStubCurl(), CURL_LOAD_BUDGET_MS);
            if (curl && !controller.signal.aborted) {
                const remainingBudgetMs = CURL_LOAD_BUDGET_MS - (performance.now() - tappedAt);
                await curl.playStubCurl(stub, {
                    signal: controller.signal,
                    photoTimeoutMs: Math.max(MIN_PHOTO_WAIT_MS, remainingBudgetMs),
                });
            }
        } catch {
            setStubTorn(stub, false);
        }
        if (controller.signal.aborted) return;

        completeAndScheduleRestore();
    }, []);

    return { stubRef, play };
};
