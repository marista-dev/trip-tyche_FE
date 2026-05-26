import { create } from 'zustand';

import { BannerInput, BannerMessage } from './types';

let nextId = 1;

interface BannerState {
    current: BannerMessage | null;
    queue: BannerMessage[];
    expanded: boolean;
    show: (msg: BannerInput) => void;
    dismiss: () => void;
    expand: () => void;
    collapse: () => void;
}

export const useBannerStore = create<BannerState>((set, get) => ({
    current: null,
    queue: [],
    expanded: false,
    show: (msg) => {
        const withId: BannerMessage = { ...msg, id: nextId++ };
        if (get().current) {
            set({ queue: [...get().queue, withId] });
        } else {
            set({ current: withId, expanded: false });
        }
    },
    dismiss: () => {
        const [next, ...rest] = get().queue;
        set({ current: next ?? null, queue: rest, expanded: false });
    },
    expand: () => set({ expanded: true }),
    collapse: () => set({ expanded: false }),
}));
