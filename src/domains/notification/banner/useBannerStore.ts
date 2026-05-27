import { create } from 'zustand';

import { BannerInput, BannerMessage } from './types';

let nextId = 1;

interface BannerState {
    current: BannerMessage | null;
    queue: BannerMessage[];
    expanded: boolean;
    pending: boolean;
    show: (msg: BannerInput) => void;
    dismiss: () => void;
    expand: () => void;
    collapse: () => void;
    setPending: (pending: boolean) => void;
}

const isDuplicate = (incoming: BannerInput, current: BannerMessage | null, queue: BannerMessage[]): boolean => {
    if (incoming.notificationId === undefined || incoming.notificationId === null) return false;
    if (current?.notificationId === incoming.notificationId) return true;
    return queue.some((m) => m.notificationId === incoming.notificationId);
};

export const useBannerStore = create<BannerState>((set, get) => ({
    current: null,
    queue: [],
    expanded: false,
    pending: false,
    show: (msg) => {
        const { current, queue } = get();
        if (isDuplicate(msg, current, queue)) return;

        const withId: BannerMessage = { ...msg, id: nextId++ };
        if (current) {
            set({ queue: [...queue, withId] });
        } else {
            set({ current: withId, expanded: false, pending: false });
        }
    },
    dismiss: () => {
        const [next, ...rest] = get().queue;
        set({ current: next ?? null, queue: rest, expanded: false, pending: false });
    },
    expand: () => set({ expanded: true }),
    collapse: () => set({ expanded: false }),
    setPending: (pending) => set({ pending }),
}));
