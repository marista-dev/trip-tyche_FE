import { AxiosError } from 'axios';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { isGuestRestrictedError } from '@/domains/user/guestPolicy';
import { useLoginPromptStore } from '@/domains/user/stores/useLoginPromptStore';
import useUserStore from '@/domains/user/stores/useUserStore';
// client.ts가 interceptors.ts를 부르고 interceptors.ts가 다시 client.ts를 부른다.
// 실제 앱과 같은 순서로 진입해야 순환이 풀리므로 client를 먼저 읽는다.
import { apiClient } from '@/libs/apis/shared/client';

vi.mock('@/platform', () => ({ isNative: () => true }));

const refreshAccessToken = vi.fn();
vi.mock('@/platform/native/auth', () => ({
    clearTokens: vi.fn().mockResolvedValue(undefined),
    getAccessToken: vi.fn().mockReturnValue('token'),
    refreshAccessToken: () => refreshAccessToken(),
}));

/** 응답 실패 경로만 떼어내 직접 호출한다. 네트워크를 타지 않는다. */
const [{ rejected }] = (
    apiClient.interceptors.response as unknown as {
        handlers: { rejected: (error: unknown) => Promise<never> }[];
    }
).handlers;

const denial = (url: string, status: 401 | 403, method = 'get', code = 1001) =>
    ({
        config: { url, method, headers: {} },
        request: {},
        response: { status, data: { status, code, message: '인증이 필요합니다.' } },
    }) as unknown as AxiosError;

describe('응답 인터셉터 — 세션과 무관한 요청', () => {
    beforeEach(() => {
        refreshAccessToken.mockReset().mockResolvedValue(false);
        useUserStore.setState({ status: 'authenticated', userInfo: null, isGuest: true });
    });

    /*
     * 게스트는 ROLE_GUEST여서 POST /v1/devices에 401을 받는다.
     * 이걸 세션 만료로 처리하는 바람에 게스트가 홈에 진입하자마자 로그인 화면으로 튕겼다.
     */
    it('/v1/devices의 401은 세션을 끊지 않는다', async () => {
        await expect(rejected(denial('/v1/devices', 401))).rejects.toBeDefined();

        expect(useUserStore.getState().status).toBe('authenticated');
        expect(refreshAccessToken).not.toHaveBeenCalled();
    });

    it('/v1/devices의 403도 세션을 끊지 않는다', async () => {
        await expect(rejected(denial('/v1/devices/abc', 403))).rejects.toBeDefined();

        expect(useUserStore.getState().status).toBe('authenticated');
    });

    it('그 외 경로의 401은 갱신 실패 시 세션을 끊는다', async () => {
        useUserStore.setState({ isGuest: false });
        await expect(rejected(denial('/v1/users/me/summary', 401))).rejects.toBeDefined();

        expect(refreshAccessToken).toHaveBeenCalled();
        expect(useUserStore.getState().status).toBe('unauthenticated');
    });

    /* 403은 권한 부족(2009)이다. 세션 만료가 아니므로 회원을 로그아웃시키면 안 된다. */
    it('회원의 403은 세션을 끊지 않는다', async () => {
        useUserStore.setState({ isGuest: false });
        await expect(rejected(denial('/v1/trips', 403, 'post', 2009))).rejects.toBeDefined();

        expect(useUserStore.getState().status).toBe('authenticated');
        expect(refreshAccessToken).not.toHaveBeenCalled();
    });
});

describe('게스트', () => {
    beforeEach(() => {
        refreshAccessToken.mockReset().mockResolvedValue(false);
        useLoginPromptStore.setState({ isOpen: false });
        useUserStore.setState({ status: 'authenticated', userInfo: null, isGuest: true });
    });

    it('쓰기가 403으로 거절되면 세션을 유지하고 로그인 유도 시트를 연다', async () => {
        const error = await rejected(denial('/v1/trips/abc', 403, 'delete', 2009)).catch((e: unknown) => e);

        expect(isGuestRestrictedError(error)).toBe(true);
        expect(useUserStore.getState().status).toBe('authenticated');
        expect(refreshAccessToken).not.toHaveBeenCalled();
        expect(useLoginPromptStore.getState().isOpen).toBe(true);
    });

    it('401은 체험 만료 — 갱신 없이 세션을 끊는다', async () => {
        await expect(rejected(denial('/v1/users/me/summary', 401))).rejects.toBeDefined();

        expect(refreshAccessToken).not.toHaveBeenCalled();
        expect(useUserStore.getState().status).toBe('unauthenticated');
    });
});
