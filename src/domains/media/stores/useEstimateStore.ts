import { create } from 'zustand';

import { MediaFile } from '@/domains/media/types';

export type EstimateMode = 'time' | 'location';

interface EstimateState {
    mode: EstimateMode | null;
    tripKey: string | null;
    targets: MediaFile[];
    setTargets: (params: { mode: EstimateMode; tripKey: string; targets: MediaFile[] }) => void;
    clear: () => void;
}

// 휘발성 세션 store — 이슈 페이지에서 채우고 추정 페이지에서 읽는다.
// 새로고침 시 비어 있으면 추정 페이지는 즉시 뒤로 폴백.
export const useEstimateStore = create<EstimateState>((set) => ({
    mode: null,
    tripKey: null,
    targets: [],
    setTargets: ({ mode, tripKey, targets }) => set({ mode, tripKey, targets }),
    clear: () => set({ mode: null, tripKey: null, targets: [] }),
}));
