import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUploadSessionStore } from '@/domains/media/stores/useUploadSessionStore';

const mediaAPIMock = { reprocessMedia: vi.fn() };
vi.mock('@/libs/apis', () => ({ mediaAPI: mediaAPIMock }));

const { reprocessFailedMedia } = await import('@/domains/media/utils/reprocessMedia');

const failedItem = (mediaFileId: number) => ({
    mediaFileId,
    currentUrl: `temp-${mediaFileId}`,
    finalUrl: `final-${mediaFileId}`,
    status: 'FAILED' as const,
    failureReason: 'corrupted',
});

beforeEach(() => {
    mediaAPIMock.reprocessMedia.mockReset();
    useUploadSessionStore.getState().reset();
});

describe('reprocessFailedMedia', () => {
    it('다시 시작한 사진은 처리 대기로, 행이 없는 사진은 세션에서 빼고, 원본이 없는 사진은 실패로 남긴다', async () => {
        useUploadSessionStore.getState().initialize('trip-key', [failedItem(1), failedItem(2), failedItem(3)]);
        mediaAPIMock.reprocessMedia.mockResolvedValue({
            success: true,
            data: [
                { mediaFileId: 1, currentUrl: 'temp-1', finalUrl: 'final-1', status: 'UPLOADED' },
                { mediaFileId: 2, currentUrl: null, finalUrl: null, status: 'NOT_FOUND' },
                { mediaFileId: 3, currentUrl: 'temp-3', finalUrl: 'final-3', status: 'SOURCE_MISSING' },
            ],
        });

        const summary = await reprocessFailedMedia('trip-key', [1, 2, 3]);

        expect(summary).toEqual({ restarted: 1, sourceMissing: 1, requestFailed: false });
        const { images, failedCount, totalCount } = useUploadSessionStore.getState();
        expect(images[1]).toMatchObject({ status: 'UPLOADED', failureReason: null });
        expect(images[2]).toBeUndefined();
        expect(images[3]).toMatchObject({ status: 'FAILED', failureReason: 'corrupted' });
        expect({ failedCount, totalCount }).toEqual({ failedCount: 1, totalCount: 2 });
    });

    it('FAILED가 아닌 사진은 서버의 현재 상태로 맞춘다(멱등)', async () => {
        useUploadSessionStore.getState().initialize('trip-key', [failedItem(1)]);
        mediaAPIMock.reprocessMedia.mockResolvedValue({
            success: true,
            data: [{ mediaFileId: 1, currentUrl: 'final-1', finalUrl: 'final-1', status: 'PROCESSED' }],
        });

        await reprocessFailedMedia('trip-key', [1]);

        expect(useUploadSessionStore.getState()).toMatchObject({ processedCount: 1, failedCount: 0 });
    });

    it('응답을 기다리는 사이 STOMP로 다시 실패한 사진은 UPLOADED로 덮지 않는다', async () => {
        useUploadSessionStore.getState().initialize('trip-key', [failedItem(1)]);
        mediaAPIMock.reprocessMedia.mockImplementation(async () => {
            useUploadSessionStore.getState().batchMarkFailed([{ mediaFileId: 1, status: 'FAILED', reason: 'again' }]);
            return {
                success: true,
                data: [{ mediaFileId: 1, currentUrl: 'temp-1', finalUrl: 'final-1', status: 'UPLOADED' }],
            };
        });

        await reprocessFailedMedia('trip-key', [1]);

        expect(useUploadSessionStore.getState().images[1]).toMatchObject({ status: 'FAILED', failureReason: 'again' });
    });

    it('100장씩 나눠 요청하고, 실패한 묶음이 있으면 알린다', async () => {
        mediaAPIMock.reprocessMedia
            .mockResolvedValueOnce({ success: true, data: [] })
            .mockResolvedValueOnce({ success: false, error: 'x' });
        const ids = Array.from({ length: 150 }, (_, i) => i + 1);

        const summary = await reprocessFailedMedia('trip-key', ids);

        expect(mediaAPIMock.reprocessMedia.mock.calls.map(([, chunkIds]) => chunkIds.length)).toEqual([100, 50]);
        expect(summary.requestFailed).toBe(true);
    });
});
