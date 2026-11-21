import { create } from 'zustand';

import type { MediaFileItem, MediaProcessedPayload, ReprocessItem } from '@/domains/media/types';

interface UploadSessionState {
    tripKey: string | null;
    images: Record<number, MediaFileItem>;
    totalCount: number;
    processedCount: number;
    failedCount: number;
    /** 이 기기가 등록해 더한 항목의 시각(ms). 동기화 요청보다 늦게 더한 항목은 그 응답에 없어도 지우지 않는다. */
    appendedAt: Record<number, number>;

    initialize: (tripKey: string, items: MediaFileItem[]) => void;
    /** 묶음별로 등록한 결과를 기존 항목에 더한다. 다른 여행의 세션이면 새로 시작한다. */
    appendItems: (tripKey: string, items: MediaFileItem[]) => void;
    /**
     * 서버의 upload-status로 그 여행의 세션을 맞춘다. 이전 업로드의 실패 사진도 여기서 들어온다.
     * requestedAt = 그 조회를 보낸 시각. 응답이 오기 전에 등록해 더한 항목은 응답에 없어도 남긴다.
     */
    syncImages: (tripKey: string, items: MediaFileItem[], requestedAt: number) => void;
    batchMarkProcessed: (events: MediaProcessedPayload[]) => void;
    batchMarkFailed: (events: MediaProcessedPayload[]) => void;
    /**
     * 재처리 결과를 반영한다. 다시 시작한 항목은 처리 대기로 돌아가고, 행이 없는 항목은 세션에서 뺀다.
     * baseline = 요청을 보낼 때의 images. 그 뒤 STOMP 등으로 바뀐 항목은 응답보다 새 정보라 덮지 않는다.
     */
    applyReprocessResults: (items: ReprocessItem[], baseline: Record<number, MediaFileItem>) => void;
    reset: () => void;
}

const computeCounts = (images: Record<number, MediaFileItem>) => {
    let processed = 0;
    let failed = 0;
    for (const item of Object.values(images)) {
        switch (item.status) {
            case 'PROCESSED':
            case 'LEGACY':
                processed++;
                break;
            case 'FAILED':
                failed++;
                break;
            case 'UPLOADED':
            case 'PROCESSING':
                break;
            // 처리 중으로 본다
            default:
                warnUnknownStatus(item.status);
        }
    }
    return {
        totalCount: Object.keys(images).length,
        processedCount: processed,
        failedCount: failed,
    };
};

/*
 * 인자가 never라 상태가 늘면 컴파일 때 처리를 빠뜨린 곳이 드러난다.
 * 실행 중에 서버가 모르는 상태를 보내면 set 안에서 던지지 않고 경고만 남긴다.
 */
const warnUnknownStatus = (status: never) => {
    console.warn('[useUploadSessionStore] 알 수 없는 상태', status);
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
    appendedAt: {},

    initialize: (tripKey, items) => {
        const images = buildImagesMap(items);
        set({ tripKey, images, appendedAt: {}, ...computeCounts(images) });
    },

    appendItems: (tripKey, items) => {
        set((state) => {
            const sameTrip = state.tripKey === tripKey;
            const images = { ...(sameTrip ? state.images : {}), ...buildImagesMap(items) };
            const now = Date.now();
            const appendedAt = { ...(sameTrip ? state.appendedAt : {}) };
            for (const item of items) appendedAt[item.mediaFileId] = now;
            return { tripKey, images, appendedAt, ...computeCounts(images) };
        });
    },

    syncImages: (tripKey, items, requestedAt) => {
        set((state) => {
            // 서버가 돌려준 항목은 서버 값이 맞다
            const images = buildImagesMap(items);
            const appendedAt: Record<number, number> = {};
            if (state.tripKey === tripKey) {
                for (const [id, at] of Object.entries(state.appendedAt)) {
                    const mediaFileId = Number(id);
                    const local = state.images[mediaFileId];
                    // 조회를 보낸 뒤에 등록돼 응답에 아직 없는 항목. 지우면 뒤이은 처리 완료 이벤트를 놓친다.
                    if (!local || mediaFileId in images || at < requestedAt) continue;
                    images[mediaFileId] = local;
                    appendedAt[mediaFileId] = at;
                }
            }
            return { tripKey, images, appendedAt, ...computeCounts(images) };
        });
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

    applyReprocessResults: (items, baseline) => {
        set((state) => {
            const next = { ...state.images };
            for (const item of items) {
                const existing = next[item.mediaFileId];
                if (!existing) continue;
                // 항목은 바뀔 때마다 새 객체가 된다. 요청 뒤에 바뀌었으면 행 삭제 외에는 응답을 버린다.
                const changedSinceRequest = existing !== baseline[item.mediaFileId];
                if (changedSinceRequest && item.status !== 'NOT_FOUND') continue;
                switch (item.status) {
                    case 'NOT_FOUND':
                        delete next[item.mediaFileId];
                        break;
                    // 원본이 없어 다시 처리할 수 없다. 실패로 남기고 호출부가 삭제 후 다시 올리라고 안내한다.
                    case 'SOURCE_MISSING':
                        break;
                    // 실패였던 항목만 처리 대기로 돌리고, 처리 완료는 뒤로 돌리지 않는다. 그 밖에는 서버의 현재 상태다.
                    case 'UPLOADED':
                    case 'PROCESSING':
                    case 'PROCESSED':
                    case 'FAILED':
                    case 'LEGACY':
                        if (existing.status === 'PROCESSED') break;
                        if (item.status === 'UPLOADED' && existing.status !== 'FAILED') break;
                        next[item.mediaFileId] = {
                            ...existing,
                            status: item.status,
                            currentUrl: item.currentUrl ?? existing.currentUrl,
                            finalUrl: item.finalUrl ?? existing.finalUrl,
                            failureReason: item.status === 'FAILED' ? existing.failureReason : null,
                        };
                        break;
                    default:
                        warnUnknownStatus(item);
                }
            }
            return { images: next, ...computeCounts(next) };
        });
    },

    reset: () => set({ tripKey: null, images: {}, appendedAt: {}, totalCount: 0, processedCount: 0, failedCount: 0 }),
}));
