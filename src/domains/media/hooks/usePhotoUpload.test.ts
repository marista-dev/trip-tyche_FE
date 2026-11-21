import { act, createElement } from 'react';

import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UploadChainError, type UploadPhase } from '@/domains/media/utils/uploadChain';

/*
 * 사진 관리 화면의 수동 재시도. 전송 자체는 useImageUpload.test.ts가 지키고, 여기서는 그 위의 흐름만 본다.
 * @testing-library/dom이 설치돼 있지 않아 렌더를 직접 한다(useImageUpload.test.ts와 같은 방식).
 */

const upload = {
    phase: 'idle' as UploadPhase,
    duplicateCount: 0,
    uploadDuplicates: vi.fn(),
    retryFailedUploads: vi.fn(),
    waitForBackgroundUpload: vi.fn<() => Promise<void>>(),
};
vi.mock('@/domains/media/hooks/useImageUpload', () => ({
    useImageUpload: () => ({
        prepareUploadFiles: vi.fn(),
        extractMetadata: vi.fn(),
        uploadImagesToS3: vi.fn(),
        retryFailedUploads: upload.retryFailedUploads,
        uploadDuplicates: upload.uploadDuplicates,
        duplicateCount: upload.duplicateCount,
        waitForBackgroundUpload: upload.waitForBackgroundUpload,
        progress: { metadata: 0 },
        uploadStats: { total: 3, succeeded: 1, failed: 2 },
        uploadPhase: upload.phase,
        imageCategories: undefined,
    }),
}));

const invalidateMock = vi.fn(async () => {});
vi.mock('@/domains/media/queryKeys', () => ({ invalidateTripMedia: () => invalidateMock() }));
vi.mock('@tanstack/react-query', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@tanstack/react-query')>()),
    useQueryClient: () => ({}),
}));
vi.mock('@/platform/native/gallery', () => ({ pickImagesFromGallery: vi.fn() }));
vi.mock('@/libs/analytics', () => ({ ANALYTICS_EVENTS: {}, track: vi.fn() }));

const showToastMock = vi.fn();
vi.mock('@/shared/stores/useToastStore', () => ({ useToastStore: () => ({ showToast: showToastMock }) }));

const { usePhotoUpload } = await import('@/domains/media/hooks/usePhotoUpload');

const renderPhotoUpload = () => {
    const result = {} as { current: ReturnType<typeof usePhotoUpload> };
    const Probe = () => {
        result.current = usePhotoUpload('trip-key');
        return null;
    };
    act(() => {
        createRoot(document.createElement('div')).render(createElement(Probe));
    });
    return result;
};

beforeEach(() => {
    upload.phase = 'idle';
    upload.duplicateCount = 0;
    upload.uploadDuplicates.mockReset();
    upload.retryFailedUploads.mockReset();
    upload.waitForBackgroundUpload.mockReset();
    invalidateMock.mockClear();
    showToastMock.mockReset();
});

describe('usePhotoUpload 수동 재시도', () => {
    it('전송이 실패한 채 끝났을 때만 재시도를 연다', () => {
        expect(renderPhotoUpload().current.canRetryUpload).toBe(false);
        upload.phase = 'uploading';
        expect(renderPhotoUpload().current.canRetryUpload).toBe(false);
        upload.phase = 'failed';
        expect(renderPhotoUpload().current.canRetryUpload).toBe(true);
    });

    it('재시도가 다시 실패하면 단계에 맞는 안내를 띄우고, 그새 등록된 묶음이 보이게 목록을 갱신한다', async () => {
        upload.phase = 'failed';
        upload.waitForBackgroundUpload.mockRejectedValue(new UploadChainError('s3', 2, '2장 업로드 실패'));
        const result = renderPhotoUpload();

        await act(async () => {
            await result.current.retryUpload();
        });

        expect(upload.retryFailedUploads).toHaveBeenCalledTimes(1);
        expect(showToastMock).toHaveBeenCalledWith('2장을 올리지 못했어요');
        expect(invalidateMock).toHaveBeenCalledTimes(1);
    });

    it('재시도가 성공하면 여기서는 알리지 않는다(onRecovered가 알린다)', async () => {
        upload.phase = 'failed';
        upload.waitForBackgroundUpload.mockResolvedValue();
        const result = renderPhotoUpload();

        await act(async () => {
            await result.current.retryUpload();
        });

        expect(upload.retryFailedUploads).toHaveBeenCalledTimes(1);
        expect(showToastMock).not.toHaveBeenCalled();
    });

    it('실패 상태가 아니면 재시도를 부르지 않는다', async () => {
        const result = renderPhotoUpload();
        await act(async () => {
            await result.current.retryUpload();
        });
        expect(upload.retryFailedUploads).not.toHaveBeenCalled();
    });
});

describe('usePhotoUpload 그래도 올리기', () => {
    it('전송이 끝났고 이미 있는 사진이 있을 때만 연다', () => {
        expect(renderPhotoUpload().current.canUploadDuplicates).toBe(false);
        upload.duplicateCount = 2;
        upload.phase = 'uploading';
        expect(renderPhotoUpload().current.canUploadDuplicates).toBe(false);
        upload.phase = 'done';
        expect(renderPhotoUpload().current.canUploadDuplicates).toBe(true);
    });

    it('중복 사진을 올리고 끝까지 기다리며, 실패하면 단계에 맞는 안내를 띄운다', async () => {
        upload.duplicateCount = 2;
        upload.phase = 'done';
        upload.waitForBackgroundUpload.mockRejectedValue(new UploadChainError('s3', 2, '2장 업로드 실패'));
        const result = renderPhotoUpload();

        await act(async () => {
            await result.current.uploadDuplicates();
        });

        expect(upload.uploadDuplicates).toHaveBeenCalledTimes(1);
        expect(showToastMock).toHaveBeenCalledWith('2장을 올리지 못했어요');
    });
});
