import { useCallback, useEffect, useRef } from 'react';

import { decideCurlTap, LOAD_BUDGET_MS, loadStubCurl, prefersReducedMotion, withinBudget } from './loadStubCurl';
import { setStubTorn } from './stubTorn';

/** 이동이 끝내 일어나지 않아 목록에 남았을 때 옆면·잠금을 되돌리는 시간 */
const RESTORE_MS = 1500;

/**
 * 1-Day 패스 탭 → 옆면 말림 → onDone(이동).
 * 어떤 실패든 onDone은 반드시 부른다. 언마운트되면 효과를 멈추고 이동하지 않는다.
 */
export const useStubCurl = () => {
    const stubRef = useRef<HTMLDivElement>(null);
    const playingRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);
    const tornRef = useRef<HTMLElement | null>(null);
    const restoreTimerRef = useRef<number>();

    useEffect(
        () => () => {
            abortRef.current?.abort();
            window.clearTimeout(restoreTimerRef.current);
            if (tornRef.current) setStubTorn(tornRef.current, false);
        },
        [],
    );

    const play = useCallback(async (onDone: () => void) => {
        const stub = stubRef.current;
        const action = decideCurlTap({
            playing: playingRef.current,
            reducedMotion: prefersReducedMotion(),
            hasStub: !!stub,
        });
        if (action === 'ignore') return;
        // 바로 이동하는 경로에서도 먼저 잠근다 — 연타가 라우트를 두 번 밀어 넣지 않게
        playingRef.current = true;
        const release = () => {
            // 이동이 끝내 일어나지 않아 목록에 남은 경우 대비(언마운트되면 cleanup이 타이머를 지운다)
            restoreTimerRef.current = window.setTimeout(() => {
                if (stub) setStubTorn(stub, false);
                playingRef.current = false;
            }, RESTORE_MS);
        };
        if (action === 'navigate' || !stub) {
            onDone();
            release();
            return;
        }

        tornRef.current = stub;
        const controller = new AbortController();
        abortRef.current = controller;
        const startedAt = performance.now();
        try {
            const curl = await withinBudget(loadStubCurl(), LOAD_BUDGET_MS);
            if (curl && !controller.signal.aborted) {
                // 청크 대기에 쓴 시간만큼 사진 대기는 줄여 탭→시작 지연을 묶어 둔다
                const left = LOAD_BUDGET_MS - (performance.now() - startedAt);
                await curl.playStubCurl(stub, { signal: controller.signal, photoTimeoutMs: Math.max(60, left) });
            }
        } catch {
            // WebGL 없음·컨텍스트 실패 등 — 효과 없이 이동한다
            setStubTorn(stub, false);
        }
        if (controller.signal.aborted) return;

        onDone();
        release();
    }, []);

    return { stubRef, play };
};
