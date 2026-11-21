import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UploadTarget } from '@/domains/media/utils/uploadTargets';

/*
 * URL 갱신: 만료 임박 판단, 동시 호출 합치기, skipped(이미 등록·행 없음) 처리.
 * 실제 체인을 거친 403 재시도는 useImageUpload.test.ts가 지킨다.
 */

const mediaAPIMock = {
    requestPresignedUrls: vi.fn(),
    renewPresignedUrls: vi.fn(),
};
vi.mock('@/libs/apis', () => ({ mediaAPI: mediaAPIMock }));

const { createUploadContext, startRun } = await import('@/domains/media/utils/uploadChain');
const { ensureFreshTarget, presignFiles, URL_RENEW_MARGIN_MS } = await import('@/domains/media/utils/uploadTargets');

const NOW = Date.parse('2026-11-21T10:00:00Z');
const MINUTE = 60_000;

const makeFiles = (n: number) =>
    Array.from({ length: n }, (_, i) => new File([new Uint8Array(10)], `p${i}.jpg`, { type: 'image/jpeg' }));

const target = (mediaFileId: number, overrides: Partial<UploadTarget> = {}): UploadTarget => ({
    mediaFileId,
    putUrl: `https://s3/old-${mediaFileId}`,
    contentType: 'image/jpeg',
    // 9분 전에 받아 30초 뒤 만료
    receivedAt: NOW - 9 * MINUTE,
    expiresAt: NOW + 30_000,
    ...overrides,
});

const renewed = (mediaFileId: number) => ({
    mediaFileId,
    presignedPutUrl: `https://s3/new-${mediaFileId}`,
    expiresAt: new Date(NOW + 10 * MINUTE).toISOString(),
    contentType: 'image/jpeg',
});

const setup = (n: number) => {
    const ctx = createUploadContext('trip-key', makeFiles(n));
    const run = startRun(ctx, 'initial');
    return { ctx, run };
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mediaAPIMock.requestPresignedUrls.mockReset();
    mediaAPIMock.renewPresignedUrls.mockReset();
    mediaAPIMock.renewPresignedUrls.mockImplementation(async (_key: string, ids: number[]) => ({
        success: true,
        data: { presignedUrls: ids.map(renewed), skipped: [] },
    }));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('ensureFreshTarget', () => {
    it('만료가 임박하면 아직 보내지 않은 다른 파일과 함께 한 번에 갱신한다', async () => {
        const { ctx, run } = setup(3);
        ctx.targets.set(0, target(1));
        ctx.targets.set(1, target(2));
        ctx.targets.set(2, target(3));
        // 이미 보낸 파일은 갱신하지 않는다
        ctx.transferred.set(2, 3);

        const fresh = await ensureFreshTarget(ctx, run, 0);

        expect(mediaAPIMock.renewPresignedUrls).toHaveBeenCalledTimes(1);
        expect(mediaAPIMock.renewPresignedUrls.mock.calls[0][1]).toEqual([1, 2]);
        expect(fresh?.putUrl).toBe('https://s3/new-1');
        expect(ctx.targets.get(1)?.putUrl).toBe('https://s3/new-2');
        expect(ctx.targets.get(2)?.putUrl).toBe('https://s3/old-3');
        expect(run.renewals).toBe(2);
    });

    it('동시에 만료를 알아챈 전송들은 한 요청을 같이 기다린다', async () => {
        const { ctx, run } = setup(2);
        ctx.targets.set(0, target(1));
        ctx.targets.set(1, target(2));

        const [a, b] = await Promise.all([ensureFreshTarget(ctx, run, 0), ensureFreshTarget(ctx, run, 1)]);

        expect(mediaAPIMock.renewPresignedUrls).toHaveBeenCalledTimes(1);
        expect([a?.putUrl, b?.putUrl]).toEqual(['https://s3/new-1', 'https://s3/new-2']);
    });

    it('여유가 있거나, 기기 시계 탓에 방금 받은 URL이 만료 직전으로 보이면 갱신하지 않는다', async () => {
        const { ctx, run } = setup(2);
        ctx.targets.set(0, target(1, { expiresAt: NOW + URL_RENEW_MARGIN_MS + 1 }));
        ctx.targets.set(1, target(2, { receivedAt: NOW - 1000 }));

        await ensureFreshTarget(ctx, run, 0);
        await ensureFreshTarget(ctx, run, 1);

        expect(mediaAPIMock.renewPresignedUrls).not.toHaveBeenCalled();
    });

    it('갱신이 실패하면 기존 URL을 그대로 쓴다', async () => {
        mediaAPIMock.renewPresignedUrls.mockResolvedValue({ success: false, error: 'x' });
        const { ctx, run } = setup(1);
        ctx.targets.set(0, target(1));

        expect((await ensureFreshTarget(ctx, run, 0))?.putUrl).toBe('https://s3/old-1');
        expect(run.renewals).toBe(0);
    });

    it('이미 등록된 파일은 등록 완료로 표시하고, 행이 지워진 파일은 새로 발급받아 바꾼다', async () => {
        mediaAPIMock.renewPresignedUrls.mockResolvedValue({
            success: true,
            data: {
                presignedUrls: [],
                skipped: [
                    { mediaFileId: 1, reason: 'ALREADY_REGISTERED' },
                    { mediaFileId: 2, reason: 'NOT_FOUND' },
                ],
            },
        });
        mediaAPIMock.requestPresignedUrls.mockResolvedValue({
            success: true,
            data: [{ mediaFileId: 20, presignedPutUrl: 'https://s3/fresh-20' }],
        });
        const { ctx, run } = setup(2);
        ctx.targets.set(0, target(1));
        ctx.targets.set(1, target(2));

        await ensureFreshTarget(ctx, run, 0);

        expect(ctx.registeredIndices.has(0)).toBe(true);
        expect(mediaAPIMock.requestPresignedUrls).toHaveBeenCalledTimes(1);
        expect(mediaAPIMock.requestPresignedUrls.mock.calls[0][1]).toEqual([
            expect.objectContaining({ fileName: 'p1.jpg' }),
        ]);
        expect(ctx.targets.get(1)).toMatchObject({ mediaFileId: 20, putUrl: 'https://s3/fresh-20' });
        expect(run.renewals).toBe(0);
    });
});

describe('presignFiles', () => {
    it('서버 상한(500장)을 넘으면 나눠 요청하고, 응답을 요청 순서대로 파일에 붙인다', async () => {
        mediaAPIMock.requestPresignedUrls.mockImplementation(async (_key: string, files: unknown[]) => ({
            success: true,
            data: files.map((_, i) => ({ mediaFileId: i + 1, presignedPutUrl: `https://s3/${i}` })),
        }));
        const { ctx } = setup(501);
        const indices = Array.from({ length: 501 }, (_, i) => i);

        expect(await presignFiles(ctx, indices)).toBeNull();

        expect(mediaAPIMock.requestPresignedUrls.mock.calls.map(([, files]) => files.length)).toEqual([500, 1]);
        expect(ctx.targets.size).toBe(501);
        expect(ctx.targets.get(500)?.putUrl).toBe('https://s3/0');
    });

    it('비었거나 octet-stream인 형식은 보내지 않아 서버가 확장자로 정하게 한다', async () => {
        mediaAPIMock.requestPresignedUrls.mockResolvedValue({ success: true, data: [] });
        const ctx = createUploadContext('trip-key', [
            new File([new Uint8Array(4)], 'a.heic', { type: 'application/octet-stream' }),
            new File([new Uint8Array(4)], 'b.heic', { type: '' }),
        ]);

        await presignFiles(ctx, [0, 1]);

        expect(mediaAPIMock.requestPresignedUrls.mock.calls[0][1]).toEqual([
            { fileName: 'a.heic', size: 4 },
            { fileName: 'b.heic', size: 4 },
        ]);
    });

    it('실패하면 그 결과(상태·코드 포함)를 돌려준다', async () => {
        const failure = { success: false, error: '파일 크기가 허용된 용량을 초과했습니다.', status: 413, code: 5005 };
        mediaAPIMock.requestPresignedUrls.mockResolvedValue(failure);
        const { ctx } = setup(1);

        expect(await presignFiles(ctx, [0])).toEqual(failure);
    });
});
