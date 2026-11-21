import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { classifyUploadError, FileReadError } from '@/domains/media/utils/uploadTelemetry';

/*
 * 웹 경로: Android 브라우저는 ERR_UPLOAD_FILE_CHANGED를 피하려고 고른 File이 아니라 메모리로 읽은 버퍼를 보낸다.
 */

vi.mock('@/platform', () => ({ isNative: () => false, isAndroidWeb: () => androidWeb }));

let androidWeb = true;
vi.mock('@/libs/apis/shared/client', () => ({ apiClient: {} }));

const { mediaAPI } = await import('@/libs/apis/media');

afterEach(() => {
    vi.restoreAllMocks();
    androidWeb = true;
});

describe('uploadToS3 웹 전송', () => {
    it('Android 브라우저는 파일을 메모리 버퍼로 읽어 같은 크기·서명된 Content-Type으로 보낸다', async () => {
        const put = vi.spyOn(axios, 'put').mockResolvedValue({ status: 200 });
        const file = new File([new Uint8Array([1, 2, 3, 4])], 'a.jpg', { type: 'image/jpeg' });

        await mediaAPI.uploadToS3('https://s3/0', file, 'image/jpeg');

        const [url, body, config] = put.mock.calls[0];
        expect(url).toBe('https://s3/0');
        expect(body).toBeInstanceOf(ArrayBuffer);
        expect((body as ArrayBuffer).byteLength).toBe(file.size);
        expect(new Uint8Array(body as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3, 4]));
        expect(config?.headers).toEqual({ 'Content-Type': 'image/jpeg' });
    });

    it('그 밖의 브라우저는 고른 파일을 그대로 보낸다', async () => {
        androidWeb = false;
        const put = vi.spyOn(axios, 'put').mockResolvedValue({ status: 200 });
        const file = new File([new Uint8Array(4)], 'a.jpg', { type: 'image/jpeg' });

        await mediaAPI.uploadToS3('https://s3/0', file, 'image/jpeg');

        expect(put.mock.calls[0][1]).toBe(file);
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
