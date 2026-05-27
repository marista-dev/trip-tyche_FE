import { create } from 'zustand';

import type { MediaFileItem, MediaProcessedPayload } from '@/domains/media/types';

interface UploadSessionState {
    tripKey: string | null;
    images: Record<number, MediaFileItem>;
    totalCount: number;
    processedCount: number;
    failedCount: number;

    initialize: (tripKey: string, items: MediaFileItem[]) => void;
    syncImages: (items: MediaFileItem[]) => void;
    batchMarkProcessed: (events: MediaProcessedPayload[]) => void;
    batchMarkFailed: (events: MediaProcessedPayload[]) => void;
    reset: () => void;
}

const computeCounts = (images: Record<number, MediaFileItem>) => {
    let processed = 0;
    let failed = 0;
    for (const item of Object.values(images)) {
        if (item.status === 'PROCESSED' || item.status === 'LEGACY') processed++;
        else if (item.status === 'FAILED') failed++;
    }
    return {
        totalCount: Object.keys(images).length,
        processedCount: processed,
        failedCount: failed,
    };
};

const buildImagesMap = (items: MediaFileItem[]): Record<number, MediaFileItem> => {
    const map: Record<number, MediaFileItem> = {};
    for (const item of items) {
        map[item.mediaFileId] = item;
    }
    return map;
};

export const useUploadSessionStore = create<UploadSessionState>((set) => ({
    tripKey: null,
    images: {},
    totalCount: 0,
    processedCount: 0,
    failedCount: 0,

    initialize: (tripKey, items) => {
        const images = buildImagesMap(items);
        set({ tripKey, images, ...computeCounts(images) });
    },

    syncImages: (items) => {
        const images = buildImagesMap(items);
        set({ images, ...computeCounts(images) });
    },

    batchMarkProcessed: (events) => {
        set((state) => {
            const next = { ...state.images };
            for (const ev of events) {
                if (ev.status !== 'PROCESSED') continue;
                const existing = next[ev.mediaFileId];
                if (!existing) continue;
                next[ev.mediaFileId] = {
                    ...existing,
                    status: 'PROCESSED',
                    finalUrl: ev.finalUrl ?? existing.finalUrl,
                    processedAt: ev.processedAt ?? existing.processedAt,
                };
            }
            return { images: next, ...computeCounts(next) };
        });
    },

    batchMarkFailed: (events) => {
        set((state) => {
            const next = { ...state.images };
            for (const ev of events) {
                if (ev.status !== 'FAILED') continue;
                const existing = next[ev.mediaFileId];
                if (!existing) continue;
                next[ev.mediaFileId] = {
                    ...existing,
                    status: 'FAILED',
                    failureReason: ev.reason ?? null,
                };
            }
            return { images: next, ...computeCounts(next) };
        });
    },

    reset: () => set({ tripKey: null, images: {}, totalCount: 0, processedCount: 0, failedCount: 0 }),
}));
