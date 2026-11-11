import { useCallback } from 'react';

import { LoginPromptReason, useLoginPromptStore } from '@/domains/user/stores/useLoginPromptStore';
import useUserStore from '@/domains/user/stores/useUserStore';

/**
 * 게스트면 동작 대신 로그인 유도 시트를 연다. 사진을 고르거나 폼을 채우기 전, 진입 버튼에서 쓴다.
 * @example <button onClick={() => requireMember('photo', openFilePicker)} />
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
