import { describe, it, expect, beforeEach } from 'vitest';

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
        useUploadSessionStore.getState().syncImages([
            { mediaFileId: 1, currentUrl: 'a', finalUrl: 'a2', status: 'PROCESSED' },
            { mediaFileId: 2, currentUrl: 'b', finalUrl: 'b2', status: 'FAILED' },
        ]);
        const state = useUploadSessionStore.getState();
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
});
