import { useCallback } from 'react';

import { LoginPromptReason, useLoginPromptStore } from '@/domains/user/stores/useLoginPromptStore';
import useUserStore from '@/domains/user/stores/useUserStore';

/**
 * 회원 전용 동작을 감싼다. 게스트면 동작 대신 로그인 유도 시트를 연다.
 *
 * 인터셉터도 게스트의 쓰기 요청을 막지만, 그건 사용자가 사진을 고르거나 폼을 채운 뒤다.
 * 작업을 시작하기 전에 알려야 수고를 버리지 않는다 — 진입 버튼에서 이 훅을 쓴다.
 *
 * @example const requireMember = useMemberOnly();
 *          <button onClick={() => requireMember('photo', openFilePicker)} />
 */
export const useMemberOnly = () => {
    const isGuest = useUserStore((s) => s.isGuest);
    const openPrompt = useLoginPromptStore((s) => s.open);

    return useCallback(
        <T>(reason: LoginPromptReason, action: () => T): T | undefined => {
            if (isGuest) {
                openPrompt(reason);
                return undefined;
            }
            return action();
        },
        [isGuest, openPrompt],
    );
};
