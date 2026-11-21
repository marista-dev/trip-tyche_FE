import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UploadAbortError, UploadHttpError } from '@/domains/media/utils/uploadTelemetry';

/*
 * VITE_S3_DIRECT_UPLOAD 경로: native-bridge가 보관한 원본 XHR 함수로 보내는지, 실패·취소를 같은 오류로 바꾸는지 본다.
 * 원본 생성자의 프로토타입은 이미 패치돼 있으므로 인스턴스 메서드가 아니라 보관된 함수를 불러야 한다.
 */

vi.mock('@/platform', () => ({ isNative: () => true, isAndroidWeb: () => false }));
vi.mock('@/libs/apis/shared/client', () => ({ apiClient: {} }));

const { mediaAPI, isDirectS3Upload } = await import('@/libs/apis/media');

class FakeXhr extends EventTarget {
    upload = new EventTarget();
    status = 0;
    // 패치된 프로토타입 메서드를 흉내 낸다. 불리면 원본 함수를 우회하지 못한 것이다.
    open = () => {
        throw new Error('patched open called');
    };
    send = () => {
        throw new Error('patched send called');
    };
}

let lastXhr: FakeXhr;
class TrackedXhr extends FakeXhr {
    constructor() {
        super();
        // eslint-disable-next-line @typescript-eslint/no-this-alias -- 테스트가 방금 만든 요청을 붙잡는다
        lastXhr = this;
    }
}
const original = {
    constructor: TrackedXhr,
    open: vi.fn(),
    setRequestHeader: vi.fn(),
    send: vi.fn(),
    abort: vi.fn(function (this: FakeXhr) {
        this.dispatchEvent(new Event('abort'));
    }),
};

const file = new File([new Uint8Array(10)], 'a.jpg', { type: 'image/jpeg' });
// 웹 input은 HEIC의 type을 비워 보내기도 한다. 서버가 확장자로 정해 서명한 값을 그대로 보내야 한다.
const untypedHeic = new File([new Uint8Array(10)], 'a.heic', { type: '' });

beforeEach(() => {
    vi.stubEnv('VITE_S3_DIRECT_UPLOAD', 'true');
    (window as unknown as { CapacitorWebXMLHttpRequest: unknown }).CapacitorWebXMLHttpRequest = original;
    Object.values(original).forEach((fn) => 'mockClear' in fn && fn.mockClear());
});

afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as unknown as { CapacitorWebXMLHttpRequest?: unknown }).CapacitorWebXMLHttpRequest;
});

describe('uploadToS3 직접 전송', () => {
    it('보관된 원본 함수로 파일을 그대로 보내고, 2xx면 끝난다', async () => {
        const upload = mediaAPI.uploadToS3('https://s3/0', untypedHeic, 'image/heic');
        expect(original.open).toHaveBeenCalledWith('PUT', 'https://s3/0');
        expect(original.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'image/heic');
        expect(original.send).toHaveBeenCalledWith(untypedHeic);
        expect(original.send.mock.contexts[0]).toBe(lastXhr);

        lastXhr.status = 200;
        lastXhr.dispatchEvent(new Event('load'));
        await expect(upload).resolves.toBeUndefined();
    });

    it('4xx 응답은 상태를 담은 UploadHttpError, 응답 없는 실패는 status null이다', async () => {
        const rejected = mediaAPI.uploadToS3('https://s3/0', file, 'image/jpeg');
        lastXhr.status = 403;
        lastXhr.dispatchEvent(new Event('load'));
        await expect(rejected).rejects.toEqual(new UploadHttpError(403));

        const offline = mediaAPI.uploadToS3('https://s3/0', file, 'image/jpeg');
        lastXhr.dispatchEvent(new Event('error'));
        await expect(offline).rejects.toMatchObject({ status: null });
    });

    it('외부 신호로 끊으면 원본 abort를 부르고 external 이유로 던진다', async () => {
        const controller = new AbortController();
        const upload = mediaAPI.uploadToS3('https://s3/0', file, 'image/jpeg', controller.signal);
        controller.abort();
        expect(original.abort).toHaveBeenCalledTimes(1);
        const error = await upload.catch((e: unknown) => e);
        expect(error).toBeInstanceOf(UploadAbortError);
        expect(error).toMatchObject({ reason: 'external' });
    });

    it('진행 이벤트가 끊기면 stall 이유로 던진다', async () => {
        vi.useFakeTimers();
        try {
            const upload = mediaAPI.uploadToS3('https://s3/0', file, 'image/jpeg');
            const settled = upload.catch((e: unknown) => e);
            lastXhr.upload.dispatchEvent(new Event('progress'));
            await vi.advanceTimersByTimeAsync(30_000);
            expect(await settled).toMatchObject({ reason: 'stall' });
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('uploadToS3 시간 상한', () => {
    it('직접 전송은 진행이 이어지면 오래 걸려도 끊지 않고, 첫 진행이 없으면 끊는다', async () => {
        vi.useFakeTimers();
        try {
            const slow = mediaAPI.uploadToS3('https://s3/0', file, 'image/jpeg');
            const slowSettled = slow.catch((e: unknown) => e);
            const slowXhr = lastXhr;
            // 20초마다 진행 → 정지 타이머(30초)에도 첫 진행 상한(120초)에도 걸리지 않는다
            for (let i = 0; i < 15; i++) {
                slowXhr.upload.dispatchEvent(new Event('progress'));
                await vi.advanceTimersByTimeAsync(20_000);
            }
            slowXhr.status = 200;
            slowXhr.dispatchEvent(new Event('load'));
            expect(await slowSettled).toBeUndefined();

            const silent = mediaAPI.uploadToS3('https://s3/0', file, 'image/jpeg').catch((e: unknown) => e);
            await vi.advanceTimersByTimeAsync(120_000);
            expect(await silent).toMatchObject({ reason: 'wall_clock' });
        } finally {
            vi.useRealTimers();
        }
    });

    it('progress가 없는 axios 경로는 파일 크기만큼 상한을 늘린다', async () => {
        vi.stubEnv('VITE_S3_DIRECT_UPLOAD', 'false');
        vi.useFakeTimers();
        // 응답 없이 매달린 요청. signal로 끊기면 axios처럼 거부한다.
        const put = vi
            .spyOn(axios, 'put')
            .mockImplementation(
                (_url, _data, config) =>
                    new Promise((_, reject) =>
                        config?.signal?.addEventListener?.('abort', () => reject(new Error('canceled'))),
                    ),
            );
        try {
            const big = new File([new Uint8Array(10)], 'big.jpg', { type: 'image/jpeg' });
            Object.defineProperty(big, 'size', { value: 50 * 1024 * 1024 });
            let settled: unknown = 'pending';
            void mediaAPI.uploadToS3('https://s3/0', big, 'image/jpeg').catch((e: unknown) => (settled = e));
            // 50MB = 120초 + 50 × 8초 = 520초
            await vi.advanceTimersByTimeAsync(519_000);
            expect(settled).toBe('pending');
            await vi.advanceTimersByTimeAsync(1_000);
            expect(settled).toMatchObject({ reason: 'wall_clock' });
        } finally {
            put.mockRestore();
            vi.useRealTimers();
        }
    });
});

describe('uploadToS3 axios 전송', () => {
    it('서명된 Content-Type을 헤더로 보낸다', async () => {
        vi.stubEnv('VITE_S3_DIRECT_UPLOAD', 'false');
        const put = vi.spyOn(axios, 'put').mockResolvedValue({});
        try {
            await mediaAPI.uploadToS3('https://s3/0', untypedHeic, 'image/heic');
            expect(put).toHaveBeenCalledWith(
                'https://s3/0',
                untypedHeic,
                expect.objectContaining({ headers: { 'Content-Type': 'image/heic' } }),
            );
        } finally {
            put.mockRestore();
        }
    });
});

describe('isDirectS3Upload', () => {
    it('플래그가 켜져 있고 원본 XHR이 보관돼 있을 때만 true다', () => {
        expect(isDirectS3Upload()).toBe(true);

        vi.stubEnv('VITE_S3_DIRECT_UPLOAD', 'false');
        expect(isDirectS3Upload()).toBe(false);

        vi.stubEnv('VITE_S3_DIRECT_UPLOAD', 'true');
        delete (window as unknown as { CapacitorWebXMLHttpRequest?: unknown }).CapacitorWebXMLHttpRequest;
        expect(isDirectS3Upload()).toBe(false);
    });
});
