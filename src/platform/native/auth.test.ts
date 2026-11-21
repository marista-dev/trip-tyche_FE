import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearTokens, refreshAccessTokenResult, saveTokens } from './auth';

vi.mock('@capacitor/preferences', () => ({
    Preferences: {
        get: vi.fn().mockResolvedValue({ value: null }),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
    },
}));
vi.mock('@/libs/analytics', () => ({
    ANALYTICS_EVENTS: {},
    consumeLoginProvider: vi.fn(),
    queuePendingEvent: vi.fn(),
}));
vi.mock('@/libs/apis/shared/constants', () => ({ API_BASE_URL: 'https://api.example.test' }));
vi.mock('axios', () => ({
    default: { post: vi.fn() },
    isAxiosError: (error: { isAxiosError?: boolean } | null) => Boolean(error?.isAxiosError),
}));

const post = vi.mocked(axios.post);

const tokenResponse = (accessToken: string, refreshToken: string) => ({
    data: { data: { accessToken, refreshToken } },
});

describe('refreshAccessTokenResult — 단일 요청 공유', () => {
    beforeEach(async () => {
        post.mockReset();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await clearTokens();
        await saveTokens({ accessToken: 'old-access', refreshToken: 'old-refresh' });
    });

    it('동시에 불러도 네트워크 요청은 한 번이고 모두 같은 결과를 받는다', async () => {
        let respond: (value: unknown) => void = () => {};
        post.mockReturnValue(new Promise((resolve) => (respond = resolve)));

        const first = refreshAccessTokenResult();
        const second = refreshAccessTokenResult();
        respond(tokenResponse('new-access', 'new-refresh'));

        await expect(Promise.all([first, second])).resolves.toEqual(['refreshed', 'refreshed']);
        expect(post).toHaveBeenCalledTimes(1);
        expect(post).toHaveBeenCalledWith('https://api.example.test/v1/auth/token/refresh', {
            refreshToken: 'old-refresh',
        });
    });

    it('끝난 뒤의 호출은 새 요청을 보내고, 회전된 refresh 토큰을 쓴다', async () => {
        post.mockResolvedValueOnce(tokenResponse('a1', 'r1')).mockResolvedValueOnce(tokenResponse('a2', 'r2'));

        await refreshAccessTokenResult();
        await refreshAccessTokenResult();

        expect(post).toHaveBeenCalledTimes(2);
        expect(post).toHaveBeenLastCalledWith('https://api.example.test/v1/auth/token/refresh', {
            refreshToken: 'r1',
        });
    });

    it('실패해도 reject하지 않고 결과를 돌려주며, 다음 호출은 다시 시도한다', async () => {
        post.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(tokenResponse('a', 'r'));

        const [first, second] = await Promise.all([refreshAccessTokenResult(), refreshAccessTokenResult()]);
        expect([first, second]).toEqual(['transient', 'transient']);
        expect(post).toHaveBeenCalledTimes(1);

        await expect(refreshAccessTokenResult()).resolves.toBe('refreshed');
        expect(post).toHaveBeenCalledTimes(2);
    });

    it('refresh 토큰이 없으면(게스트) 요청 없이 rejected', async () => {
        await clearTokens();

        await expect(refreshAccessTokenResult()).resolves.toBe('rejected');
        expect(post).not.toHaveBeenCalled();
    });
});

describe('refreshAccessTokenResult — 결과 구분', () => {
    const failure = (status?: number) =>
        Object.assign(new Error('failed'), { isAxiosError: true, response: status ? { status } : undefined });

    beforeEach(async () => {
        post.mockReset();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await clearTokens();
        await saveTokens({ accessToken: 'old-access', refreshToken: 'old-refresh' });
    });

    it('성공하면 refreshed', async () => {
        post.mockResolvedValue(tokenResponse('a', 'r'));

        await expect(refreshAccessTokenResult()).resolves.toBe('refreshed');
    });

    it.each([401, 403])('서버가 %i로 거절하면 rejected (재시도해도 소용없다)', async (status) => {
        post.mockRejectedValue(failure(status));

        await expect(refreshAccessTokenResult()).resolves.toBe('rejected');
    });

    it('refresh 토큰이 없으면(게스트) rejected이고 요청하지 않는다', async () => {
        await clearTokens();

        await expect(refreshAccessTokenResult()).resolves.toBe('rejected');
        expect(post).not.toHaveBeenCalled();
    });

    it.each([503, 429])('서버가 %i를 돌려주면 transient (재시도하면 풀릴 수 있다)', async (status) => {
        post.mockRejectedValue(failure(status));

        await expect(refreshAccessTokenResult()).resolves.toBe('transient');
    });

    it('응답이 없는 네트워크 오류·타임아웃은 transient', async () => {
        post.mockRejectedValue(failure());

        await expect(refreshAccessTokenResult()).resolves.toBe('transient');
    });

    it('200인데 토큰이 없는 응답(캡티브 포털 등)은 transient', async () => {
        post.mockResolvedValue({ data: '<html>login</html>' });

        await expect(refreshAccessTokenResult()).resolves.toBe('transient');
    });
});
