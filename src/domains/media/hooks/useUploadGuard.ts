import { useEffect } from 'react';

import { useBlocker } from 'react-router-dom';

import type { UploadPhase } from '@/domains/media/utils/uploadChain';

export const UPLOAD_GUARD_TEXT = {
    hint: '업로드가 끝날 때까지 앱을 닫지 마세요',
    leaveTitle: '업로드 중이에요',
    leaveDescription: '나가면 남은 사진은 올라가지 않아요.',
    leaveConfirm: '나가기',
    leaveCancel: '계속 올리기',
} as const;

/** 화면을 떠나면 남은 사진을 잃는 단계. done·failed는 떠나도 잃을 진행이 없다. */
export const isUploadInProgress = (phase: UploadPhase) =>
    phase === 'preparing' || phase === 'uploading' || phase === 'registering' || phase === 'finalizing';

/*
 * 업로드 중 화면 이탈을 막고 화면이 꺼지지 않게 한다.
 * Android 하드웨어 뒤로가기도 history.back()이라 같은 차단에 걸린다(appShell.ts). 앱 종료·새로고침은 막지 않는다.
 */
export const useUploadGuard = (active: boolean) => {
    const blocker = useBlocker(active);
    const isLeaveBlocked = blocker.state === 'blocked';

    // 묻는 사이 업로드가 끝났으면 더 지킬 것이 없다. 사용자가 원래 하려던 이동을 이어 간다.
    useEffect(() => {
        if (!active && blocker.state === 'blocked') blocker.proceed();
    }, [active, blocker]);

    // 화면이 꺼지면 Android가 WebView를 멈추거나 죽여 전송이 끊긴다. 가려지면 브라우저가 잠금을 풀므로 돌아올 때 다시 잡는다.
    useEffect(() => {
        if (!active || !('wakeLock' in navigator)) return;
        let sentinel: WakeLockSentinel | null = null;
        let disposed = false;

        const acquire = async () => {
            if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
            try {
                const next = await navigator.wakeLock.request('screen');
                if (disposed) void next.release().catch(() => {});
                else sentinel = next;
            } catch {
                // 배터리 절약 모드·권한 정책으로 거부될 수 있다. 업로드는 잠금 없이도 계속된다.
            }
        };
        const onVisibilityChange = () => void acquire();

        void acquire();
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            disposed = true;
            document.removeEventListener('visibilitychange', onVisibilityChange);
            void sentinel?.release().catch(() => {});
        };
    }, [active]);

    return {
        isLeaveBlocked,
        stay: () => blocker.reset?.(),
        leave: () => blocker.proceed?.(),
    };
};
