import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { classifyUploadError, FileReadError } from '@/domains/media/utils/uploadTelemetry';

/*
 * 웹 경로: Android Chrome의 ERR_UPLOAD_FILE_CHANGED를 피하려고 고른 File이 아니라 메모리로 읽은 Blob을 보낸다.
 */

vi.mock('@/platform', () => ({ isNative: () => false }));
vi.mock('@/libs/apis/shared/client', () => ({ apiClient: {} }));

const { mediaAPI } = await import('@/libs/apis/media');

afterEach(() => {
    vi.restoreAllMocks();
});

describe('uploadToS3 웹 전송', () => {
    it('파일을 메모리 Blob으로 읽어 같은 크기·서명된 Content-Type으로 보낸다', async () => {
        const put = vi.spyOn(axios, 'put').mockResolvedValue({ status: 200 });
        const file = new File([new Uint8Array([1, 2, 3, 4])], 'a.jpg', { type: 'image/jpeg' });

        await mediaAPI.uploadToS3('https://s3/0', file, 'image/jpeg');

        const [url, body, config] = put.mock.calls[0];
        expect(url).toBe('https://s3/0');
        expect(body).toBeInstanceOf(Blob);
        expect(body).not.toBe(file);
        expect((body as Blob).size).toBe(file.size);
        expect(new Uint8Array(await (body as Blob).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
        expect(config?.headers).toEqual({ 'Content-Type': 'image/jpeg' });
    });

    it('파일을 읽지 못하면 보내지 않고 file_unreadable로 분류되는 오류를 던진다', async () => {
        const put = vi.spyOn(axios, 'put');
        const file = new File([new Uint8Array(4)], 'a.jpg', { type: 'image/jpeg' });
        vi.spyOn(file, 'arrayBuffer').mockRejectedValue(new DOMException('gone', 'NotReadableError'));

        const error = await mediaAPI.uploadToS3('https://s3/0', file, 'image/jpeg').catch((e: unknown) => e);

        expect(error).toBeInstanceOf(FileReadError);
        expect(classifyUploadError(error)).toBe('file_unreadable');
        expect(put).not.toHaveBeenCalled();
    });
});
