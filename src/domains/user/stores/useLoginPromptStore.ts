import { create } from 'zustand';

/** 어떤 동작에서 막혔는지. 시트 문구가 맥락에 맞게 바뀐다. */
export type LoginPromptReason = 'photo' | 'trip' | 'edit' | 'profile' | 'share' | 'delete';

interface LoginPromptState {
    isOpen: boolean;
    reason: LoginPromptReason;
    open: (reason?: LoginPromptReason) => void;
    close: () => void;
}

export const useLoginPromptStore = create<LoginPromptState>((set, get) => ({
    isOpen: false,
    reason: 'edit',
    open: (reason = 'edit') => {
        // 버튼 단계 가드와 인터셉터가 연달아 부를 수 있다 — 먼저 연 쪽의 맥락을 유지한다.
        if (get().isOpen) return;
        set({ isOpen: true, reason });
    },
    close: () => set({ isOpen: false }),
}));
