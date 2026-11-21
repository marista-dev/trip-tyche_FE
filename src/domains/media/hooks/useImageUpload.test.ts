import { act, createElement } from 'react';

import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUploadSessionStore } from '@/domains/media/stores/useUploadSessionStore';
import type { ClientImageFile } from '@/domains/media/types';
import { UploadAbortError } from '@/domains/media/utils/uploadTelemetry';

/*
 * 업로드 추적 이벤트의 짝 맞춤을 지킨다: upload_started 1번당, 체인 실행마다 upload_finished가 정확히 1번.
 * 리뷰에서 나온 회귀(끝난 업로드를 재시도해 가짜 종료 이벤트, 대기 중 취소가 unknown으로 집계)를 막는다.
 */

const trackMock = vi.fn();
vi.mock('@/libs/analytics', () => ({
    ANALYTICS_EVENTS: {
        UPLOAD_STARTED: 'upload_started',
        UPLOAD_FINISHED: 'upload_finished',
        UPLOAD_BACKGROUNDED: 'upload_backgrounded',
    },
    track: (...args: unknown[]) => trackMock(...args),
}));

vi.mock('react-router-dom', () => ({ useParams: () => ({ tripKey: 'trip-key' }) }));

const mediaAPIMock = {
    requestPresignedUrls: vi.fn(),
    renewPresignedUrls: vi.fn(),
    uploadToS3: vi.fn(),
    triggerMediaProcessing: vi.fn(),
};
vi.mock('@/libs/apis', () => ({ mediaAPI: mediaAPIMock }));

let directUpload = false;
vi.mock('@/libs/apis/media', () => ({ isDirectS3Upload: () => directUpload }));

const extractMetadataMock = vi.fn();
vi.mock('@/libs/utils/image', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/libs/utils/image')>()),
    extractMetadataFromImage: (...args: unknown[]) => extractMetadataMock(...args),
}));

const showToastMock = vi.fn();
vi.mock('@/shared/stores/useToastStore', () => ({
    useToastStore: { getState: () => ({ showToast: showToastMock }) },
}));

const { useImageUpload } = await import('@/domains/media/hooks/useImageUpload');
const { UploadChainError } = await import('@/domains/media/utils/uploadChain');

// @testing-library/dom이 설치돼 있지 않아 renderHook을 직접 만든다(SwappableImage.test.tsx와 같은 방식).
const renderHook = <T>(useHook: () => T) => {
    const result = {} as { current: T };
    const Probe = () => {
        result.current = useHook();
        return null;
    };
    const container = document.createElement('div');
    act(() => {
        createRoot(container).render(createElement(Probe));
    });
    return { result };
};

const makeFiles = (n: number) =>
    Array.from({ length: n }, (_, i) => new File([new Uint8Array(1000)], `p${i}.jpg`, { type: 'image/jpeg' }));

// EXIF 읽기를 건너뛰려고 미리 계산한 메타데이터를 넘긴다
const metadataFor = (files: File[]): ClientImageFile[] =>
    files.map((image) => ({ image, recordDate: '2026-11-21T10:00:00', latitude: 37.5, longitude: 127 }));

const eventsNamed = (name: string) =>
    trackMock.mock.calls.filter(([event]) => event === name).map(([, props]) => props as Record<string, unknown>);

type RegisterItem = { mediaFileId: number };
const presignOk = (n: number, firstId = 1) => ({
    success: true,
    data: Array.from({ length: n }, (_, i) => ({ mediaFileId: firstId + i, presignedPutUrl: `https://s3/${i}` })),
});
const duplicateItem = {
    mediaFileId: null,
    fileKey: null,
    tempKey: null,
    finalKey: null,
    presignedPutUrl: null,
    expiresAt: null,
    contentType: null,
    duplicate: true,
    duplicateOfMediaFileId: 77,
};
const registerOk = (items: RegisterItem[]) => ({
    success: true,
    data: items.map(({ mediaFileId }) => ({ mediaFileId, currentUrl: 'u', finalUrl: 'u', status: 'UPLOADED' })),
});

beforeEach(() => {
    trackMock.mockReset();
    showToastMock.mockReset();
    mediaAPIMock.requestPresignedUrls.mockReset();
    mediaAPIMock.renewPresignedUrls.mockReset();
    mediaAPIMock.uploadToS3.mockReset();
    mediaAPIMock.triggerMediaProcessing.mockReset();
    extractMetadataMock.mockReset();
    directUpload = false;
    mediaAPIMock.requestPresignedUrls.mockImplementation(async (_key: string, names: unknown[]) =>
        presignOk(names.length),
    );
    // 기본은 갱신 실패: 4xx는 같은 URL로 다시 보내지 않고 끝난다
    mediaAPIMock.renewPresignedUrls.mockResolvedValue({ success: false, error: 'x' });
    extractMetadataMock.mockImplementation(async (files: File[]) => metadataFor(files));
    mediaAPIMock.triggerMediaProcessing.mockImplementation(async (_key: string, items: RegisterItem[]) =>
        registerOk(items),
    );
    useUploadSessionStore.getState().reset();
});

const startUpload = async (files: File[]) => {
    const { result } = renderHook(() => useImageUpload({ source: 'manage' }));
    await act(async () => {
        await result.current.uploadImagesToS3(files, undefined, metadataFor(files));
    });
    await act(async () => {
        await result.current.waitForBackgroundUpload().catch(() => {});
    });
    return result;
};

describe('useImageUpload 추적 이벤트', () => {
    it('성공한 업로드는 started 1번, finished(success) 1번을 같은 upload_id로 보낸다', async () => {
        mediaAPIMock.uploadToS3.mockResolvedValue(undefined);

        await startUpload(makeFiles(3));

        const [started] = eventsNamed('upload_started');
        const finished = eventsNamed('upload_finished');
        expect(finished).toHaveLength(1);
        expect(finished[0]).toMatchObject({
            upload_id: started.upload_id,
            outcome: 'success',
            failed_stage: null,
            attempt: 1,
            trigger: 'initial',
            total: 3,
            succeeded: 3,
            failed: 0,
            superseded: false,
        });
    });

    it('이미 끝난 업로드에 재시도를 눌러도 finished를 다시 보내지 않는다', async () => {
        mediaAPIMock.uploadToS3.mockResolvedValue(undefined);
        const result = await startUpload(makeFiles(2));

        await act(async () => {
            result.current.retryFailedUploads();
            await result.current.waitForBackgroundUpload().catch(() => {});
        });

        expect(eventsNamed('upload_finished')).toHaveLength(1);
    });

    it('URL 발급 실패는 presign 단계 실패 finished 1번으로 끝난다', async () => {
        mediaAPIMock.requestPresignedUrls.mockResolvedValue({ success: false, error: 'x' });

        await startUpload(makeFiles(2));

        const finished = eventsNamed('upload_finished');
        expect(finished).toHaveLength(1);
        expect(finished[0]).toMatchObject({ outcome: 'failed', failed_stage: 'presign', attempt: 1 });
    });

    it('S3 실패 뒤 수동 재시도는 attempt 2의 finished를 따로 보내고, 성공 장수는 누적한다', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
            // 첫 실행: 0번 파일은 3번 시도 모두 실패, 1번 파일은 성공
            mediaAPIMock.uploadToS3.mockImplementation(async (url: string) => {
                if (url.endsWith('/0')) throw new Error('boom');
            });
            const result = await startUpload(makeFiles(2));

            mediaAPIMock.uploadToS3.mockResolvedValue(undefined);
            await act(async () => {
                result.current.retryFailedUploads();
                await result.current.waitForBackgroundUpload().catch(() => {});
            });

            const finished = eventsNamed('upload_finished');
            expect(finished).toHaveLength(2);
            expect(finished[0]).toMatchObject({
                attempt: 1,
                outcome: 'failed',
                failed_stage: 's3',
                failed: 1,
                fail_unknown: 1,
                file_retries: 2,
                succeeded: 1,
            });
            expect(finished[1]).toMatchObject({
                attempt: 2,
                trigger: 'manual_retry',
                outcome: 'success',
                succeeded: 2,
                failed: 0,
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it('오프라인으로 끊긴 파일은 unknown이 아니라 aborted로 센다', async () => {
        // 전송을 붙잡아 두고 offline 이벤트로 끊는다. 실제 uploadToS3처럼 외부 취소를 UploadAbortError로 던진다.
        mediaAPIMock.uploadToS3.mockImplementation(
            (_url: string, _file: File, _contentType: string, signal: AbortSignal) =>
                new Promise((_, reject) =>
                    signal.addEventListener('abort', () => reject(new UploadAbortError('external'))),
                ),
        );
        const { result } = renderHook(() => useImageUpload({ source: 'manage' }));
        const files = makeFiles(2);
        await act(async () => {
            await result.current.uploadImagesToS3(files, undefined, metadataFor(files));
        });
        await act(async () => {
            window.dispatchEvent(new Event('offline'));
            await result.current.waitForBackgroundUpload().catch(() => {});
        });

        const [finished] = eventsNamed('upload_finished');
        expect(finished).toMatchObject({
            outcome: 'failed',
            failed_stage: 's3',
            failed: 2,
            fail_aborted: 2,
            fail_unknown: 0,
        });
    });
});

const forbidden = () => {
    const config = { headers: new AxiosHeaders() };
    const response = { status: 403, statusText: '', headers: {}, config, data: null } as AxiosResponse;
    return new AxiosError('forbidden', 'ERR_BAD_REQUEST', config, null, response);
};

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
};

const flush = () => new Promise((r) => setTimeout(r, 0));

const rejectionOf = (promise: Promise<void>) =>
    promise.then(
        () => null,
        (e: unknown) => e,
    );

describe('useImageUpload 묶음 등록', () => {
    it('120장은 50장씩 3번 등록하고, 세션 스토어에 모두 쌓는다', async () => {
        mediaAPIMock.uploadToS3.mockResolvedValue(undefined);
        // 같은 여행의 세션에 있던 항목(예: 동기화로 받은 이전 실패 사진)은 지우지 않고 더한다
        useUploadSessionStore
            .getState()
            .initialize('trip-key', [{ mediaFileId: 999, currentUrl: 'x', finalUrl: 'x', status: 'FAILED' }]);

        await startUpload(makeFiles(120));

        const sizes = mediaAPIMock.triggerMediaProcessing.mock.calls.map(([, items]) => items.length);
        expect(sizes.sort((a, b) => b - a)).toEqual([50, 50, 20]);
        const session = useUploadSessionStore.getState();
        expect(session.totalCount).toBe(121);
        expect(session.images[999].status).toBe('FAILED');
        expect(eventsNamed('upload_finished')).toHaveLength(1);
    });

    it('한 묶음 등록이 실패해도 다른 묶음은 등록되고, 재시도는 남은 묶음만 다시 등록한다', async () => {
        mediaAPIMock.uploadToS3.mockResolvedValue(undefined);
        let failSecondBatch = true;
        // 응답이 온 실패(4xx)라 자동으로 다시 보내지 않는다
        mediaAPIMock.triggerMediaProcessing.mockImplementation(async (_key: string, items: RegisterItem[]) =>
            failSecondBatch && items[0].mediaFileId === 51
                ? { success: false, error: 'x', status: 400 }
                : registerOk(items),
        );
        const { result } = renderHook(() => useImageUpload({ source: 'manage' }));
        const files = makeFiles(120);
        await act(async () => {
            await result.current.uploadImagesToS3(files, undefined, metadataFor(files));
        });
        let error: unknown;
        await act(async () => {
            error = await rejectionOf(result.current.waitForBackgroundUpload());
        });

        expect(error).toBeInstanceOf(UploadChainError);
        expect(error).toMatchObject({ stage: 'register', failedCount: 50 });
        expect(mediaAPIMock.triggerMediaProcessing).toHaveBeenCalledTimes(3);
        expect(useUploadSessionStore.getState().totalCount).toBe(70);
        expect(result.current.uploadPhase).toBe('failed');

        failSecondBatch = false;
        await act(async () => {
            result.current.retryFailedUploads();
            await result.current.waitForBackgroundUpload();
        });

        expect(mediaAPIMock.triggerMediaProcessing).toHaveBeenCalledTimes(4);
        expect(mediaAPIMock.triggerMediaProcessing.mock.calls[3][1][0].mediaFileId).toBe(51);
        // 전송은 다시 하지 않는다
        expect(mediaAPIMock.uploadToS3).toHaveBeenCalledTimes(120);
        expect(useUploadSessionStore.getState().totalCount).toBe(120);
        expect(eventsNamed('upload_finished')[1]).toMatchObject({ attempt: 2, outcome: 'success' });
        expect(result.current.uploadStats).toEqual({ total: 120, succeeded: 120, failed: 0 });
    });
});

describe('useImageUpload 덜 찬 묶음 등록', () => {
    it('한 장이 끝내 실패해도 같은 묶음의 올라간 사진은 등록한다', async () => {
        mediaAPIMock.uploadToS3.mockImplementation(async (url: string) => {
            if (url.endsWith('/0')) throw forbidden();
        });
        const { result } = renderHook(() => useImageUpload({ source: 'manage' }));
        const files = makeFiles(2);
        let error: unknown;
        await act(async () => {
            await result.current.uploadImagesToS3(files, undefined, metadataFor(files));
            error = await rejectionOf(result.current.waitForBackgroundUpload());
        });

        expect(error).toMatchObject({ stage: 's3', failedCount: 1 });
        expect(mediaAPIMock.triggerMediaProcessing).toHaveBeenCalledTimes(1);
        expect(mediaAPIMock.triggerMediaProcessing.mock.calls[0][1].map((i: RegisterItem) => i.mediaFileId)).toEqual([
            2,
        ]);
        expect(useUploadSessionStore.getState().images[2]).toBeDefined();

        // 재시도는 남은 한 장만 올리고 그것만 등록한다
        mediaAPIMock.uploadToS3.mockResolvedValue(undefined);
        await act(async () => {
            result.current.retryFailedUploads();
            await result.current.waitForBackgroundUpload();
        });
        expect(mediaAPIMock.triggerMediaProcessing.mock.calls[1][1].map((i: RegisterItem) => i.mediaFileId)).toEqual([
            1,
        ]);
    });
});

describe('useImageUpload 진행 중인 묶음 등록', () => {
    it('이전 체인의 등록 요청 뒤에 올라간 파일은 그 요청이 끝난 뒤 이어서 등록한다', async () => {
        mediaAPIMock.uploadToS3.mockImplementation(async (url: string) => {
            if (url.endsWith('/1')) throw forbidden();
        });
        const firstRegister = deferred<ReturnType<typeof registerOk>>();
        mediaAPIMock.triggerMediaProcessing.mockImplementationOnce(() => firstRegister.promise);
        const { result } = renderHook(() => useImageUpload({ source: 'manage' }));
        const files = makeFiles(2);
        await act(async () => {
            await result.current.uploadImagesToS3(files, undefined, metadataFor(files));
            await flush();
        });
        // 첫 체인은 0번만 등록 요청을 보내고 응답을 기다리는 중이다
        expect(mediaAPIMock.triggerMediaProcessing).toHaveBeenCalledTimes(1);

        mediaAPIMock.uploadToS3.mockResolvedValue(undefined);
        await act(async () => {
            result.current.retryFailedUploads();
            await flush();
            firstRegister.resolve(registerOk([{ mediaFileId: 1 }]));
            await result.current.waitForBackgroundUpload();
        });

        const sent = mediaAPIMock.triggerMediaProcessing.mock.calls.map(([, items]) =>
            items.map((i: RegisterItem) => i.mediaFileId),
        );
        expect(sent).toEqual([[1], [2]]);
        expect(result.current.uploadPhase).toBe('done');
        expect(eventsNamed('upload_finished').find((e) => e.attempt === 2)).toMatchObject({ outcome: 'success' });
    });
});

describe('useImageUpload 실패와 재시도', () => {
    it('4xx에 URL을 새로 받지 못하면 다시 보내지 않고 s3 단계 실패로 끝낸다', async () => {
        mediaAPIMock.uploadToS3.mockImplementation(async (url: string) => {
            if (url.endsWith('/0')) throw forbidden();
        });
        const { result } = renderHook(() => useImageUpload({ source: 'manage' }));
        const files = makeFiles(2);
        await act(async () => {
            await result.current.uploadImagesToS3(files, undefined, metadataFor(files));
        });
        let error: unknown;
        await act(async () => {
            error = await rejectionOf(result.current.waitForBackgroundUpload());
        });

        const calls = mediaAPIMock.uploadToS3.mock.calls.filter(([url]) => String(url).endsWith('/0'));
        expect(calls).toHaveLength(1);
        expect(error).toMatchObject({ stage: 's3', failedCount: 1 });
        expect(eventsNamed('upload_finished')[0]).toMatchObject({
            failed_stage: 's3',
            fail_http_4xx: 1,
            file_retries: 0,
        });
        expect(result.current.uploadStats).toEqual({ total: 2, succeeded: 1, failed: 1 });
    });

    it('URL 발급 실패 뒤 재시도는 발급부터 다시 하고, 같은 upload_id의 attempt 2로 성공한다', async () => {
        mediaAPIMock.uploadToS3.mockResolvedValue(undefined);
        mediaAPIMock.requestPresignedUrls.mockResolvedValueOnce({ success: false, error: '서버 오류' });
        const { result } = renderHook(() => useImageUpload({ source: 'create' }));
        const files = makeFiles(2);
        let outcome: { started: boolean } | undefined;
        await act(async () => {
            outcome = await result.current.uploadImagesToS3(files, undefined, metadataFor(files));
        });
        let error: unknown;
        await act(async () => {
            error = await rejectionOf(result.current.waitForBackgroundUpload());
        });
        expect(outcome).toEqual({ started: false });
        expect(error).toMatchObject({ stage: 'presign', failedCount: 2, message: '서버 오류' });

        await act(async () => {
            result.current.retryFailedUploads();
            await result.current.waitForBackgroundUpload();
        });

        expect(mediaAPIMock.requestPresignedUrls).toHaveBeenCalledTimes(2);
        const [started] = eventsNamed('upload_started');
        expect(eventsNamed('upload_started')).toHaveLength(1);
        const finished = eventsNamed('upload_finished');
        expect(finished).toHaveLength(2);
        expect(finished[0]).toMatchObject({ upload_id: started.upload_id, failed_stage: 'presign', attempt: 1 });
        expect(finished[1]).toMatchObject({
            upload_id: started.upload_id,
            attempt: 2,
            trigger: 'manual_retry',
            outcome: 'success',
            succeeded: 2,
        });
        expect(result.current.uploadPhase).toBe('done');
    });

    it('준비 중에 재시도가 겹쳐도 URL은 한 번만 발급하고, 끊긴 실행은 superseded로 끝난다', async () => {
        mediaAPIMock.uploadToS3.mockResolvedValue(undefined);
        let resolvePresign!: (value: ReturnType<typeof presignOk>) => void;
        mediaAPIMock.requestPresignedUrls.mockImplementationOnce(
            () => new Promise((resolve) => (resolvePresign = resolve)),
        );
        const { result } = renderHook(() => useImageUpload({ source: 'create' }));
        const files = makeFiles(2);
        let starting!: Promise<{ started: boolean }>;
        act(() => {
            starting = result.current.uploadImagesToS3(files, undefined, metadataFor(files));
        });

        await act(async () => {
            // 첫 실행이 URL을 기다리는 사이 재시도(예: 온라인 복귀와 버튼이 겹침)
            result.current.retryFailedUploads();
            resolvePresign(presignOk(2));
            await starting;
            await result.current.waitForBackgroundUpload();
        });

        expect(mediaAPIMock.requestPresignedUrls).toHaveBeenCalledTimes(1);
        expect(mediaAPIMock.triggerMediaProcessing).toHaveBeenCalledTimes(1);
        const finished = eventsNamed('upload_finished');
        expect(finished).toHaveLength(2);
        expect(finished.find((e) => e.attempt === 1)).toMatchObject({ superseded: true, outcome: 'failed' });
        expect(finished.find((e) => e.attempt === 2)).toMatchObject({ superseded: false, outcome: 'success' });
        expect(result.current.uploadPhase).toBe('done');
    });

    it('onRecovered는 첫 실행 성공에는 부르지 않고, 재시도가 성공했을 때만 부른다', async () => {
        const onRecovered = vi.fn();
        mediaAPIMock.uploadToS3.mockResolvedValue(undefined);
        const first = renderHook(() => useImageUpload({ source: 'manage', onRecovered }));
        const files = makeFiles(2);
        await act(async () => {
            await first.result.current.uploadImagesToS3(files, undefined, metadataFor(files));
            await first.result.current.waitForBackgroundUpload();
        });
        expect(onRecovered).not.toHaveBeenCalled();

        mediaAPIMock.uploadToS3.mockImplementation(async (url: string) => {
            if (url.endsWith('/0')) throw forbidden();
        });
        const { result } = renderHook(() => useImageUpload({ source: 'manage', onRecovered }));
        await act(async () => {
            await result.current.uploadImagesToS3(files, undefined, metadataFor(files));
            await rejectionOf(result.current.waitForBackgroundUpload());
        });
        expect(onRecovered).not.toHaveBeenCalled();

        mediaAPIMock.uploadToS3.mockResolvedValue(undefined);
        await act(async () => {
            result.current.retryFailedUploads();
            await result.current.waitForBackgroundUpload();
        });
        expect(onRecovered).toHaveBeenCalledTimes(1);
        // 성공 장수는 재시도를 넘어 두 번 세지 않는다
        expect(result.current.uploadStats).toEqual({ total: 2, succeeded: 2, failed: 0 });
    });
});

describe('useImageUpload 화면 상태', () => {
    it('uploadPhase는 준비 → 전송 → 등록 → 마무리 → 완료 순으로 바뀐다', async () => {
        const presign = deferred<ReturnType<typeof presignOk>>();
        const upload = deferred<void>();
        const register = deferred<ReturnType<typeof registerOk>>();
        const post = deferred<void>();
        mediaAPIMock.requestPresignedUrls.mockReturnValue(presign.promise);
        mediaAPIMock.uploadToS3.mockReturnValue(upload.promise);
        mediaAPIMock.triggerMediaProcessing.mockReturnValue(register.promise);

        const phases: string[] = [];
        const { result } = renderHook(() => {
            const hook = useImageUpload({ source: 'create' });
            if (phases[phases.length - 1] !== hook.uploadPhase) phases.push(hook.uploadPhase);
            return hook;
        });
        const files = makeFiles(2);
        let uploading: Promise<{ started: boolean }> | undefined;
        act(() => {
            uploading = result.current.uploadImagesToS3(files, () => post.promise, metadataFor(files));
        });
        expect(result.current.uploadPhase).toBe('preparing');

        await act(async () => {
            presign.resolve(presignOk(2));
            await uploading;
        });
        expect(result.current.uploadPhase).toBe('uploading');

        await act(async () => {
            upload.resolve();
            await flush();
        });
        expect(result.current.uploadPhase).toBe('registering');

        await act(async () => {
            register.resolve(registerOk([{ mediaFileId: 1 }, { mediaFileId: 2 }]));
            await flush();
        });
        expect(result.current.uploadPhase).toBe('finalizing');

        await act(async () => {
            post.resolve();
            await result.current.waitForBackgroundUpload();
        });
        expect(phases).toEqual(['idle', 'preparing', 'uploading', 'registering', 'finalizing', 'done']);
    });

    it('prepareUploadFiles는 중복을 빼고 검증해, 제외된 사진이 있으면 토스트를 한 번 띄운다', async () => {
        const { result } = renderHook(() => useImageUpload({ source: 'manage' }));
        const [a, b] = makeFiles(2);
        const text = new File(['x'], 'note.txt', { type: 'text/plain' });

        let accepted: File[] = [];
        await act(async () => {
            accepted = await result.current.prepareUploadFiles([a, a, b, text], { skippedNonImage: 1 });
        });
        expect(accepted).toEqual([a, b]);
        expect(showToastMock).toHaveBeenCalledTimes(1);
        expect(showToastMock.mock.calls[0][0]).toContain('지원하지 않는 형식 1장');

        showToastMock.mockReset();
        await act(async () => {
            await result.current.prepareUploadFiles([a, b]);
        });
        expect(showToastMock).not.toHaveBeenCalled();
    });

    it('피커의 안내(위치 권한 등)는 제외 안내와 한 토스트로 합친다. 제외가 없어도 안내는 띄운다', async () => {
        const { result } = renderHook(() => useImageUpload({ source: 'manage' }));
        const [a] = makeFiles(1);

        await act(async () => {
            await result.current.prepareUploadFiles([a], { skippedNonImage: 2, notice: '위치 권한이 꺼져 있어요.' });
        });
        expect(showToastMock).toHaveBeenCalledTimes(1);
        expect(showToastMock.mock.calls[0][0]).toBe('위치 권한이 꺼져 있어요. 영상·녹음 2개는 제외했어요.');

        showToastMock.mockReset();
        await act(async () => {
            await result.current.prepareUploadFiles([a], { notice: '위치 권한이 꺼져 있어요.' });
        });
        expect(showToastMock.mock.calls).toEqual([['위치 권한이 꺼져 있어요.']]);
    });

    it('upload_started에 S3 직접 전송 여부를 싣는다', async () => {
        mediaAPIMock.uploadToS3.mockResolvedValue(undefined);
        await startUpload(makeFiles(1));
        directUpload = true;
        await startUpload(makeFiles(1));
        expect(eventsNamed('upload_started').map((e) => e.direct_upload)).toEqual([false, true]);
    });
});

describe('useImageUpload URL 발급: 크기·형식·촬영 시각과 중복', () => {
    it('EXIF를 먼저 읽고, 파일마다 크기·형식·촬영 시각을 보낸다(없거나 기본값이면 뺀다)', async () => {
        mediaAPIMock.uploadToS3.mockResolvedValue(undefined);
        const metadata = deferred<ClientImageFile[]>();
        extractMetadataMock.mockReturnValue(metadata.promise);
        const dated = new File([new Uint8Array(10)], 'a.jpg', { type: 'image/jpeg' });
        const untyped = new File([new Uint8Array(20)], 'b.heic', { type: '' });
        const undated = new File([new Uint8Array(30)], 'c.png', { type: 'image/png' });
        const { result } = renderHook(() => useImageUpload({ source: 'manage' }));
        let uploading!: Promise<{ started: boolean }>;
        act(() => {
            uploading = result.current.uploadImagesToS3([dated, untyped, undated]);
        });
        await act(flush);
        expect(mediaAPIMock.requestPresignedUrls).not.toHaveBeenCalled();

        await act(async () => {
            metadata.resolve([
                { image: dated, recordDate: '2026-11-21T10:00:00', latitude: 0, longitude: 0 },
                { image: untyped, recordDate: '1980-01-01T00:00:00', latitude: 0, longitude: 0 },
                { image: undated, recordDate: '', latitude: 0, longitude: 0 },
            ]);
            await uploading;
            await result.current.waitForBackgroundUpload();
        });

        expect(mediaAPIMock.requestPresignedUrls).toHaveBeenCalledTimes(1);
        expect(mediaAPIMock.requestPresignedUrls.mock.calls[0].slice(1)).toEqual([
            [
                { fileName: 'a.jpg', size: 10, contentType: 'image/jpeg', recordDate: '2026-11-21T10:00:00' },
                { fileName: 'b.heic', size: 20 },
                { fileName: 'c.png', size: 30, contentType: 'image/png' },
            ],
            { allowDuplicates: false },
        ]);
    });

    it('PUT은 서명된 Content-Type을 보내고, 서버가 주지 않으면 파일의 type을 쓴다', async () => {
        mediaAPIMock.uploadToS3.mockResolvedValue(undefined);
        mediaAPIMock.requestPresignedUrls.mockResolvedValue({
            success: true,
            data: [
                { mediaFileId: 1, presignedPutUrl: 'https://s3/0', contentType: 'image/heic' },
                { mediaFileId: 2, presignedPutUrl: 'https://s3/1', contentType: null },
            ],
        });
        await startUpload(makeFiles(2));

        const typeByUrl = Object.fromEntries(
            mediaAPIMock.uploadToS3.mock.calls.map(([url, , contentType]) => [url, contentType]),
        );
        expect(typeByUrl).toEqual({ 'https://s3/0': 'image/heic', 'https://s3/1': 'image/jpeg' });
    });

    it('형식 거부(5008)는 업로드 전 검증과 같은 분류를 싣는다', async () => {
        mediaAPIMock.requestPresignedUrls.mockResolvedValue({
            success: false,
            error: '지원하지 않는 파일 형식입니다.',
            status: 400,
            code: 5008,
        });
        const { result } = renderHook(() => useImageUpload({ source: 'manage' }));
        const files = makeFiles(2);
        let error: unknown;
        await act(async () => {
            await result.current.uploadImagesToS3(files, undefined, metadataFor(files));
            error = await rejectionOf(result.current.waitForBackgroundUpload());
        });
        expect(error).toMatchObject({ stage: 'presign', rejectReason: 'unsupported_format' });
    });

    it('요청 형식 오류(1006)는 invalid_request로 싣는다', async () => {
        mediaAPIMock.requestPresignedUrls.mockResolvedValue({ success: false, error: 'x', status: 400, code: 1006 });
        const { result } = renderHook(() => useImageUpload({ source: 'manage' }));
        const files = makeFiles(1);
        let error: unknown;
        await act(async () => {
            await result.current.uploadImagesToS3(files, undefined, metadataFor(files));
            error = await rejectionOf(result.current.waitForBackgroundUpload());
        });
        expect(error).toMatchObject({ stage: 'presign', rejectReason: 'invalid_request' });
    });

    it('중복은 보내지도 등록하지도 않고 실패로 세지 않는다. 그래도 올리기는 그 파일만 allowDuplicates로 올린다', async () => {
        mediaAPIMock.uploadToS3.mockResolvedValue(undefined);
        mediaAPIMock.requestPresignedUrls.mockResolvedValueOnce({
            success: true,
            data: [
                { mediaFileId: 1, presignedPutUrl: 'https://s3/0' },
                duplicateItem,
                { mediaFileId: 3, presignedPutUrl: 'https://s3/2' },
            ],
        });
        const files = makeFiles(3);
        const result = await startUpload(files);

        expect(mediaAPIMock.uploadToS3.mock.calls.map(([url]) => url).sort()).toEqual(['https://s3/0', 'https://s3/2']);
        expect(mediaAPIMock.triggerMediaProcessing.mock.calls[0][1].map((i: RegisterItem) => i.mediaFileId)).toEqual([
            1, 3,
        ]);
        expect(result.current.uploadPhase).toBe('done');
        expect(result.current.duplicateCount).toBe(1);
        expect(result.current.uploadStats).toEqual({ total: 2, succeeded: 2, failed: 0 });
        expect(eventsNamed('upload_finished')[0]).toMatchObject({ outcome: 'success', duplicate_count: 1, failed: 0 });

        mediaAPIMock.requestPresignedUrls.mockResolvedValueOnce(presignOk(1, 9));
        await act(async () => {
            result.current.uploadDuplicates();
            await result.current.waitForBackgroundUpload();
        });

        expect(mediaAPIMock.requestPresignedUrls.mock.calls[1].slice(1)).toEqual([
            [expect.objectContaining({ fileName: files[1].name })],
            { allowDuplicates: true },
        ]);
        expect(mediaAPIMock.triggerMediaProcessing.mock.calls[1][1].map((i: RegisterItem) => i.mediaFileId)).toEqual([
            9,
        ]);
        expect(result.current.duplicateCount).toBe(0);
        expect(useUploadSessionStore.getState().totalCount).toBe(3);
        expect(eventsNamed('upload_finished')[1]).toMatchObject({
            trigger: 'allow_duplicates',
            outcome: 'success',
            duplicate_count: 0,
        });
    });
});

describe('useImageUpload 그래도 올리기(진행 중)', () => {
    it('전송 중에 누르면 지금 실행이 성공으로 끝난 뒤 한 번만 돈다', async () => {
        const upload = deferred<void>();
        mediaAPIMock.uploadToS3.mockReturnValue(upload.promise);
        mediaAPIMock.requestPresignedUrls.mockResolvedValueOnce({
            success: true,
            data: [{ mediaFileId: 1, presignedPutUrl: 'https://s3/0' }, duplicateItem],
        });
        const { result } = renderHook(() => useImageUpload({ source: 'create' }));
        const files = makeFiles(2);
        await act(async () => {
            await result.current.uploadImagesToS3(files, undefined, metadataFor(files));
        });
        expect(result.current.duplicateCount).toBe(1);

        act(() => {
            result.current.uploadDuplicates();
            result.current.uploadDuplicates();
        });
        expect(result.current.duplicateCount).toBe(0);
        expect(mediaAPIMock.requestPresignedUrls).toHaveBeenCalledTimes(1);

        mediaAPIMock.uploadToS3.mockResolvedValue(undefined);
        await act(async () => {
            upload.resolve();
            await flush();
            await result.current.waitForBackgroundUpload();
        });

        expect(mediaAPIMock.requestPresignedUrls).toHaveBeenCalledTimes(2);
        const finished = eventsNamed('upload_finished');
        expect(finished).toHaveLength(2);
        expect(finished[0]).toMatchObject({ attempt: 1, outcome: 'success', superseded: false });
        expect(finished[1]).toMatchObject({ attempt: 2, trigger: 'allow_duplicates', outcome: 'success' });
    });
});

describe('useImageUpload 기다리는 쪽과 그래도 올리기', () => {
    it('기다리는 중에 그래도 올리기를 누르면 그 업로드까지 기다리고, 그 실패를 받는다', async () => {
        const upload = deferred<void>();
        mediaAPIMock.uploadToS3.mockReturnValue(upload.promise);
        mediaAPIMock.requestPresignedUrls.mockResolvedValueOnce({
            success: true,
            data: [{ mediaFileId: 1, presignedPutUrl: 'https://s3/0' }, duplicateItem],
        });
        const { result } = renderHook(() => useImageUpload({ source: 'create' }));
        const files = makeFiles(2);
        await act(async () => {
            await result.current.uploadImagesToS3(files, undefined, metadataFor(files));
        });

        // 티켓 발급 단계가 먼저 기다리기 시작한다
        let settled: unknown = 'pending';
        const waiting = result.current.waitForBackgroundUpload().then(
            () => 'resolved',
            (e: unknown) => e,
        );
        void waiting.then((value) => (settled = value));
        mediaAPIMock.requestPresignedUrls.mockResolvedValueOnce({ success: false, error: '서버 오류' });
        act(() => {
            result.current.uploadDuplicates();
        });

        await act(async () => {
            upload.resolve();
            await flush();
            await waiting;
        });

        expect(eventsNamed('upload_finished')[0]).toMatchObject({ attempt: 1, outcome: 'success' });
        expect(settled).toBeInstanceOf(UploadChainError);
        expect(settled).toMatchObject({ stage: 'presign', message: '서버 오류' });
    });
});

describe('useImageUpload URL 갱신', () => {
    it('PUT이 403이면 URL을 한 번 갱신해 다시 보낸다', async () => {
        mediaAPIMock.uploadToS3.mockImplementation(async (url: string) => {
            if (url === 'https://s3/0') throw forbidden();
        });
        mediaAPIMock.renewPresignedUrls.mockResolvedValue({
            success: true,
            data: { presignedUrls: [{ mediaFileId: 1, presignedPutUrl: 'https://s3/renewed-1' }], skipped: [] },
        });
        const result = await startUpload(makeFiles(2));

        expect(mediaAPIMock.renewPresignedUrls).toHaveBeenCalledTimes(1);
        expect(mediaAPIMock.renewPresignedUrls.mock.calls[0][1]).toEqual([1]);
        expect(mediaAPIMock.uploadToS3.mock.calls.map(([url]) => url)).toContain('https://s3/renewed-1');
        expect(result.current.uploadPhase).toBe('done');
        expect(eventsNamed('upload_finished')[0]).toMatchObject({ outcome: 'success', renewed_count: 1 });
    });

    it('갱신한 URL도 거부되면 더 갱신하지 않고 실패로 끝낸다', async () => {
        mediaAPIMock.uploadToS3.mockImplementation(async (url: string) => {
            if (url !== 'https://s3/1') throw forbidden();
        });
        mediaAPIMock.renewPresignedUrls.mockResolvedValue({
            success: true,
            data: { presignedUrls: [{ mediaFileId: 1, presignedPutUrl: 'https://s3/renewed-1' }], skipped: [] },
        });
        const { result } = renderHook(() => useImageUpload({ source: 'manage' }));
        const files = makeFiles(2);
        let error: unknown;
        await act(async () => {
            await result.current.uploadImagesToS3(files, undefined, metadataFor(files));
            error = await rejectionOf(result.current.waitForBackgroundUpload());
        });

        expect(mediaAPIMock.renewPresignedUrls).toHaveBeenCalledTimes(1);
        const firstFilePuts = mediaAPIMock.uploadToS3.mock.calls.filter(([url]) => url !== 'https://s3/1');
        expect(firstFilePuts).toHaveLength(2);
        expect(error).toMatchObject({ stage: 's3', failedCount: 1 });
        expect(eventsNamed('upload_finished')[0]).toMatchObject({ fail_http_4xx: 1, renewed_count: 1 });
    });
});

describe('useImageUpload 등록 재전송과 항목별 상태', () => {
    it('응답 없이 실패한 등록은 같은 묶음을 한 번 더 보낸다', async () => {
        mediaAPIMock.uploadToS3.mockResolvedValue(undefined);
        mediaAPIMock.triggerMediaProcessing.mockResolvedValueOnce({ success: false, error: 'timeout' });
        const result = await startUpload(makeFiles(2));

        const sent = mediaAPIMock.triggerMediaProcessing.mock.calls.map(([, items]) =>
            items.map((i: RegisterItem) => i.mediaFileId),
        );
        expect(sent).toEqual([
            [1, 2],
            [1, 2],
        ]);
        expect(result.current.uploadPhase).toBe('done');
    });

    it('항목별 상태: FAILED는 등록된 것으로 세션에 보이고, NOT_FOUND는 등록 실패로 세며 재시도가 새로 발급받아 다시 올린다', async () => {
        mediaAPIMock.uploadToS3.mockResolvedValue(undefined);
        mediaAPIMock.triggerMediaProcessing.mockResolvedValueOnce({
            success: true,
            data: [
                { mediaFileId: 1, currentUrl: null, finalUrl: null, status: 'NOT_FOUND' },
                { mediaFileId: 2, currentUrl: 'u', finalUrl: 'u', status: 'FAILED' },
                { mediaFileId: 3, currentUrl: 'u', finalUrl: 'u', status: 'PROCESSED' },
            ],
        });
        const { result } = renderHook(() => useImageUpload({ source: 'manage' }));
        const files = makeFiles(3);
        let error: unknown;
        await act(async () => {
            await result.current.uploadImagesToS3(files, undefined, metadataFor(files));
            error = await rejectionOf(result.current.waitForBackgroundUpload());
        });

        expect(error).toMatchObject({ stage: 'register', failedCount: 1 });
        expect(eventsNamed('upload_finished')[0]).toMatchObject({
            failed_stage: 'register',
            register_not_found: 1,
            failed: 0,
        });
        const session = useUploadSessionStore.getState();
        expect(Object.keys(session.images).map(Number).sort()).toEqual([2, 3]);
        expect(session.failedCount).toBe(1);

        mediaAPIMock.requestPresignedUrls.mockResolvedValueOnce(presignOk(1, 11));
        await act(async () => {
            result.current.retryFailedUploads();
            await result.current.waitForBackgroundUpload();
        });

        expect(mediaAPIMock.requestPresignedUrls.mock.calls[1][1]).toEqual([
            expect.objectContaining({ fileName: files[0].name }),
        ]);
        expect(mediaAPIMock.uploadToS3).toHaveBeenCalledTimes(4);
        expect(mediaAPIMock.triggerMediaProcessing.mock.calls[1][1].map((i: RegisterItem) => i.mediaFileId)).toEqual([
            11,
        ]);
        expect(result.current.uploadPhase).toBe('done');
        expect(useUploadSessionStore.getState().totalCount).toBe(3);
    });
});
