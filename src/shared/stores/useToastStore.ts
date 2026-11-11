import { create } from 'zustand';

interface ToastProps {
    isVisible: boolean;
    message: string;
    showToast: (message: string) => void;
    hideToast: () => void;
}

export const useToastStore = create<ToastProps>((set) => ({
    isVisible: false,
    message: '',
    showToast: (message: string) => {
        // 빈 메시지는 '이미 다른 UI로 알렸다'는 뜻이다(예: 게스트 로그인 유도 시트).
        if (!message) return;
        set({ isVisible: true, message });
    },
    hideToast: () => set({ isVisible: false, message: '' }),
}));
