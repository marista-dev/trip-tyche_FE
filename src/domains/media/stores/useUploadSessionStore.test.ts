import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useUploadSessionStore } from './useUploadSessionStore';

describe('useUploadSessionStore', () => {
    beforeEach(() => useUploadSessionStore.getState().reset());

    it('initializes with items and computes counts', () => {
        useUploadSessionStore.getState().initialize('trip-1', [
            { mediaFileId: 1, currentUrl: 'a', finalUrl: 'a', status: 'UPLOADED' },
            { mediaFileId: 2, currentUrl: 'b', finalUrl: 'b', status: 'PROCESSED' },
        ]);
        const state = useUploadSessionStore.getState();
        expect(state.tripKey).toBe('trip-1');
        expect(state.totalCount).toBe(2);
        expect(state.processedCount).toBe(1);
        expect(state.failedCount).toBe(0);
        expect(state.images[1].status).toBe('UPLOADED');
        expect(state.images[2].status).toBe('PROCESSED');
    });

    it('counts LEGACY status as processed', () => {
        useUploadSessionStore.getState().initialize('trip-2', [
            { mediaFileId: 1, currentUrl: 'a', finalUrl: 'a', status: 'LEGACY' },
            { mediaFileId: 2, currentUrl: 'b', finalUrl: 'b', status: 'PROCESSED' },
        ]);
        const state = useUploadSessionStore.getState();
        expect(state.processedCount).toBe(2);
    });

    it('batchMarkProcessed updates status, finalUrl, and processedAt', () => {
        useUploadSessionStore
            .getState()
            .initialize('trip-1', [{ mediaFileId: 10, currentUrl: 'old', finalUrl: 'old', status: 'PROCESSING' }]);
        useUploadSessionStore
            .getState()
            .batchMarkProcessed([
                { mediaFileId: 10, status: 'PROCESSED', finalUrl: 'new-url', processedAt: '2024-01-01T00:00:00Z' },
            ]);
        const state = useUploadSessionStore.getState();
        expect(state.images[10].status).toBe('PROCESSED');
        expect(state.images[10].finalUrl).toBe('new-url');
        expect(state.images[10].processedAt).toBe('2024-01-01T00:00:00Z');
        expect(state.processedCount).toBe(1);
    });

    it('batchMarkFailed updates status and failureReason', () => {
        useUploadSessionStore
            .getState()
            .initialize('trip-1', [{ mediaFileId: 5, currentUrl: 'x', finalUrl: 'x', status: 'PROCESSING' }]);
        useUploadSessionStore.getState().batchMarkFailed([{ mediaFileId: 5, status: 'FAILED', reason: 'timeout' }]);
        const state = useUploadSessionStore.getState();
        expect(state.images[5].status).toBe('FAILED');
        expect(state.images[5].failureReason).toBe('timeout');
        expect(state.failedCount).toBe(1);
        expect(state.processedCount).toBe(0);
    });

    it('ignores events for unknown mediaFileId', () => {
        useUploadSessionStore
            .getState()
            .initialize('trip-1', [{ mediaFileId: 1, currentUrl: 'a', finalUrl: 'a', status: 'UPLOADED' }]);
        useUploadSessionStore.getState().batchMarkProcessed([{ mediaFileId: 999, status: 'PROCESSED', finalUrl: 'x' }]);
        const state = useUploadSessionStore.getState();
        expect(state.images[999]).toBeUndefined();
        expect(state.images[1].status).toBe('UPLOADED');
    });

    it('reset clears all state', () => {
        useUploadSessionStore
            .getState()
            .initialize('trip-1', [{ mediaFileId: 1, currentUrl: 'a', finalUrl: 'a', status: 'PROCESSED' }]);
        useUploadSessionStore.getState().reset();
        const state = useUploadSessionStore.getState();
        expect(state.tripKey).toBeNull();
        expect(state.totalCount).toBe(0);
        expect(state.processedCount).toBe(0);
        expect(state.failedCount).toBe(0);
        expect(Object.keys(state.images)).toHaveLength(0);
    });

    it('syncImages replaces images and recomputes counts', () => {
        useUploadSessionStore
            .getState()
            .initialize('trip-1', [{ mediaFileId: 1, currentUrl: 'a', finalUrl: 'a', status: 'UPLOADED' }]);
        useUploadSessionStore.getState().syncImages(
            'trip-1',
            [
                { mediaFileId: 1, currentUrl: 'a', finalUrl: 'a2', status: 'PROCESSED' },
                { mediaFileId: 2, currentUrl: 'b', finalUrl: 'b2', status: 'FAILED' },
            ],
            Date.now(),
        );
        const state = useUploadSessionStore.getState();
        expect(state.tripKey).toBe('trip-1');
        expect(state.totalCount).toBe(2);
        expect(state.processedCount).toBe(1);
        expect(state.failedCount).toBe(1);
        expect(state.images[1].finalUrl).toBe('a2');
    });

    it('batchMarkProcessed skips events with non-PROCESSED status', () => {
        useUploadSessionStore
            .getState()
            .initialize('trip-1', [{ mediaFileId: 1, currentUrl: 'a', finalUrl: 'a', status: 'UPLOADED' }]);
        useUploadSessionStore.getState().batchMarkProcessed([{ mediaFileId: 1, status: 'FAILED' }]);
        const state = useUploadSessionStore.getState();
        expect(state.images[1].status).toBe('UPLOADED');
    });

    it('appendItems accumulates items for the same trip', () => {
        const store = useUploadSessionStore.getState();
        store.initialize('trip-1', [{ mediaFileId: 1, currentUrl: 'a', finalUrl: 'a', status: 'UPLOADED' }]);
        store.appendItems('trip-1', [{ mediaFileId: 2, currentUrl: 'b', finalUrl: 'b', status: 'PROCESSED' }]);
        const state = useUploadSessionStore.getState();
        expect(state.totalCount).toBe(2);
        expect(state.processedCount).toBe(1);
        expect(Object.keys(state.images)).toEqual(['1', '2']);
    });

    it('동기화로 받은 이전 업로드의 실패 사진은 같은 여행의 새 등록이 지우지 않는다', () => {
        const store = useUploadSessionStore.getState();
        store.syncImages('trip-1', [{ mediaFileId: 1, currentUrl: 'a', finalUrl: 'a', status: 'FAILED' }], Date.now());
        store.appendItems('trip-1', [{ mediaFileId: 2, currentUrl: 'b', finalUrl: 'b', status: 'UPLOADED' }]);
        expect(useUploadSessionStore.getState()).toMatchObject({ totalCount: 2, failedCount: 1 });
    });

    it('재처리 응답이 STOMP 처리 완료보다 늦게 와도 처리 완료를 되돌리지 않는다', () => {
        const store = useUploadSessionStore.getState();
        store.initialize('trip-1', [
            { mediaFileId: 1, currentUrl: 'a', finalUrl: 'a', status: 'FAILED' },
            { mediaFileId: 2, currentUrl: 'b', finalUrl: 'b', status: 'PROCESSING' },
        ]);
        const baseline = useUploadSessionStore.getState().images;
        store.batchMarkProcessed([{ mediaFileId: 1, status: 'PROCESSED', finalUrl: 'a2' }]);
        store.applyReprocessResults(
            [
                { mediaFileId: 1, currentUrl: 'a', finalUrl: 'a', status: 'UPLOADED' },
                { mediaFileId: 2, currentUrl: 'b', finalUrl: 'b', status: 'UPLOADED' },
            ],
            baseline,
        );
        const { images } = useUploadSessionStore.getState();
        expect(images[1]).toMatchObject({ status: 'PROCESSED', finalUrl: 'a2' });
        // 실패였던 항목만 처리 대기로 돌린다
        expect(images[2].status).toBe('PROCESSING');
    });

    it('재처리 응답보다 먼저 온 새 실패 이벤트를 UPLOADED로 덮지 않는다', () => {
        const store = useUploadSessionStore.getState();
        store.initialize('trip-1', [
            { mediaFileId: 1, currentUrl: 'a', finalUrl: 'a', status: 'FAILED', failureReason: 'old' },
        ]);
        const baseline = useUploadSessionStore.getState().images;
        // 다시 시작한 처리가 응답보다 먼저 또 실패했다
        store.batchMarkFailed([{ mediaFileId: 1, status: 'FAILED', reason: 'new' }]);
        store.applyReprocessResults([{ mediaFileId: 1, currentUrl: 'a', finalUrl: 'a', status: 'UPLOADED' }], baseline);
        expect(useUploadSessionStore.getState().images[1]).toMatchObject({ status: 'FAILED', failureReason: 'new' });
    });

    it('동기화 응답보다 늦게 등록된 항목은 응답에 없어도 남기고, 그 전 항목은 서버 결과를 따른다', () => {
        vi.useFakeTimers();
        try {
            const store = useUploadSessionStore.getState();
            vi.setSystemTime(1_000);
            store.appendItems('trip-1', [{ mediaFileId: 1, currentUrl: 'a', finalUrl: 'a', status: 'UPLOADED' }]);
            vi.setSystemTime(2_000);
            const requestedAt = Date.now();
            vi.setSystemTime(3_000);
            store.appendItems('trip-1', [{ mediaFileId: 2, currentUrl: 'b', finalUrl: 'b', status: 'UPLOADED' }]);
            store.syncImages(
                'trip-1',
                [{ mediaFileId: 3, currentUrl: 'c', finalUrl: 'c', status: 'FAILED' }],
                requestedAt,
            );
            const { images } = useUploadSessionStore.getState();
            expect(Object.keys(images).map(Number).sort()).toEqual([2, 3]);

            // 이후 처리 완료 이벤트가 남긴 항목에 닿는다
            store.batchMarkProcessed([{ mediaFileId: 2, status: 'PROCESSED', finalUrl: 'b2' }]);
            expect(useUploadSessionStore.getState().images[2].status).toBe('PROCESSED');
        } finally {
            vi.useRealTimers();
        }
    });

    it('다른 여행으로 동기화하면 이전 여행의 항목은 남기지 않는다', () => {
        const store = useUploadSessionStore.getState();
        store.appendItems('trip-1', [{ mediaFileId: 1, currentUrl: 'a', finalUrl: 'a', status: 'UPLOADED' }]);
        store.syncImages('trip-2', [], 0);
        expect(useUploadSessionStore.getState()).toMatchObject({ tripKey: 'trip-2', totalCount: 0 });
    });

    it('모르는 상태가 와도 던지지 않고 처리 중으로 센다', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const unknown = { mediaFileId: 1, currentUrl: 'a', finalUrl: 'a', status: 'QUEUED' } as never;
            expect(() => useUploadSessionStore.getState().syncImages('trip-1', [unknown], Date.now())).not.toThrow();
            expect(useUploadSessionStore.getState()).toMatchObject({
                totalCount: 1,
                processedCount: 0,
                failedCount: 0,
            });
            expect(warn).toHaveBeenCalled();
        } finally {
            warn.mockRestore();
        }
    });

    it('appendItems starts fresh for a different trip', () => {
        const store = useUploadSessionStore.getState();
        store.initialize('trip-1', [{ mediaFileId: 1, currentUrl: 'a', finalUrl: 'a', status: 'UPLOADED' }]);
        store.appendItems('trip-2', [{ mediaFileId: 2, currentUrl: 'b', finalUrl: 'b', status: 'UPLOADED' }]);
        const state = useUploadSessionStore.getState();
        expect(state.tripKey).toBe('trip-2');
        expect(state.totalCount).toBe(1);
        expect(state.images[1]).toBeUndefined();
    });
});
