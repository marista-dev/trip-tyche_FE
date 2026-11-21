import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isAuthRejection, refreshWebSession, shareInFlight, type RefreshResult } from './tokenRefresh';

vi.mock('@/libs/apis/shared/constants', () => ({ API_BASE_URL: 'https://api.example.test' }));
vi.mock('axios', () => ({
    default: { post: vi.fn() },
    isAxiosError: (error: { isAxiosError?: boolean } | null) => Boolean(error?.isAxiosError),
}));

const post = vi.mocked(axios.post);

const failure = (status?: number) =>
    Object.assign(new Error('failed'), { isAxiosError: true, response: status ? { status } : undefined });

describe('isAuthRejection — 앱·웹이 함께 쓰는 거절/일시 실패 분류', () => {
    // 세션이 없을 때(쿠키 없음·토큰 폐기·만료)도 서버는 4xx로 답한다
    it.each([400, 401, 403, 404])('서버가 %i로 거절하면 거절(재시도해도 소용없다)', (status) => {
        expect(isAuthRejection(failure(status))).toBe(true);
    });

    it.each([500, 502, 503, 408, 429])('%i는 재시도하면 풀릴 수 있어 거절이 아니다', (status) => {
        expect(isAuthRejection(failure(status))).toBe(false);
    });

    it('응답이 없는 네트워크 오류·타임아웃, axios 밖의 오류는 거절이 아니다', () => {
        expect(isAuthRejection(failure())).toBe(false);
        expect(isAuthRejection(new Error('boom'))).toBe(false);
        expect(isAuthRejection(null)).toBe(false);
    });
});

describe('shareInFlight', () => {
    it('진행 중에는 요청 하나를 공유하고, 끝나면(실패 포함) 다음 호출이 새로 시작한다', async () => {
        const results: RefreshResult[] = ['transient', 'refreshed'];
        let finish: (result: RefreshResult) => void = () => {};
        const request = vi.fn(() => new Promise<RefreshResult>((resolve) => (finish = resolve)));
        const refresh = shareInFlight(request);

        const first = Promise.all([refresh(), refresh()]);
        finish(results[0]);
        await expect(first).resolves.toEqual(['transient', 'transient']);
        expect(request).toHaveBeenCalledTimes(1);

        const second = refresh();
        finish(results[1]);
        await expect(second).resolves.toBe('refreshed');
        expect(request).toHaveBeenCalledTimes(2);
    });
});

describe('refreshWebSession (쿠키 갱신)', () => {
    beforeEach(() => {
        post.mockReset();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('쿠키를 실어 갱신하고 성공하면 refreshed', async () => {
        post.mockResolvedValue({ data: {} });

        await expect(refreshWebSession()).resolves.toBe('refreshed');
        expect(post).toHaveBeenCalledWith('https://api.example.test/v1/auth/refresh', {}, { withCredentials: true });
    });

    it('서버가 4xx로 거절하면 rejected', async () => {
        post.mockRejectedValue(failure(401));

        await expect(refreshWebSession()).resolves.toBe('rejected');
    });

    it.each([500, 429, undefined])('상태 %s(5xx·호출 제한·응답 없음)는 transient', async (status) => {
        post.mockRejectedValue(failure(status));

        await expect(refreshWebSession()).resolves.toBe('transient');
    });

    it('병렬 401이 겹쳐도 요청은 한 번이고 끝나면 다시 시도할 수 있다', async () => {
        let respond: (value: unknown) => void = () => {};
        post.mockReturnValueOnce(new Promise((resolve) => (respond = resolve)));

        const results = Promise.all([refreshWebSession(), refreshWebSession(), refreshWebSession()]);
        respond({ data: {} });

        await expect(results).resolves.toEqual(['refreshed', 'refreshed', 'refreshed']);
        expect(post).toHaveBeenCalledTimes(1);

        post.mockResolvedValueOnce({ data: {} });
        await refreshWebSession();
        expect(post).toHaveBeenCalledTimes(2);
    });
});
