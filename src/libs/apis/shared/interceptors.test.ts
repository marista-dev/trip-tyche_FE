import { AxiosError } from 'axios';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { isGuestRestrictedError } from '@/domains/user/guestPolicy';
import { useLoginPromptStore } from '@/domains/user/stores/useLoginPromptStore';
import useUserStore from '@/domains/user/stores/useUserStore';
// client.ts가 interceptors.ts를 부르고 interceptors.ts가 다시 client.ts를 부른다.
// 실제 앱과 같은 순서로 진입해야 순환이 풀리므로 client를 먼저 읽는다.
import { apiClient } from '@/libs/apis/shared/client';

const platform = vi.hoisted(() => ({ native: true }));
vi.mock('@/platform', () => ({ isNative: () => platform.native }));

const refreshAccessTokenResult = vi.fn();
const refreshWebSession = vi.fn();
const clearTokens = vi.fn();
vi.mock('@/platform/native/auth', () => ({
    clearTokens: () => clearTokens(),
    getAccessToken: vi.fn().mockReturnValue('token'),
    refreshAccessTokenResult: () => refreshAccessTokenResult(),
}));
vi.mock('@/libs/apis/shared/tokenRefresh', () => ({ refreshWebSession: () => refreshWebSession() }));

beforeEach(() => {
    platform.native = true;
    refreshWebSession.mockReset();
});

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
        refreshAccessTokenResult.mockReset().mockResolvedValue('rejected');
        clearTokens.mockReset().mockResolvedValue(undefined);
        useUserStore.setState({ status: 'authenticated', userInfo: null, isGuest: true });
    });

    /*
     * 게스트는 ROLE_GUEST여서 POST /v1/devices에 401을 받는다.
     * 이걸 세션 만료로 처리하는 바람에 게스트가 홈에 진입하자마자 로그인 화면으로 튕겼다.
     */
    it('/v1/devices의 401은 세션을 끊지 않는다', async () => {
        await expect(rejected(denial('/v1/devices', 401))).rejects.toBeDefined();

        expect(useUserStore.getState().status).toBe('authenticated');
        expect(refreshAccessTokenResult).not.toHaveBeenCalled();
    });

    it('/v1/devices의 403도 세션을 끊지 않는다', async () => {
        await expect(rejected(denial('/v1/devices/abc', 403))).rejects.toBeDefined();

        expect(useUserStore.getState().status).toBe('authenticated');
    });

    it('그 외 경로의 401은 갱신 실패 시 세션을 끊는다', async () => {
        useUserStore.setState({ isGuest: false });
        await expect(rejected(denial('/v1/users/me/summary', 401))).rejects.toBeDefined();

        expect(refreshAccessTokenResult).toHaveBeenCalled();
        expect(useUserStore.getState().status).toBe('unauthenticated');
    });

    /* 403은 권한 부족(2009)이다. 세션 만료가 아니므로 회원을 로그아웃시키면 안 된다. */
    it('회원의 403은 세션을 끊지 않는다', async () => {
        useUserStore.setState({ isGuest: false });
        await expect(rejected(denial('/v1/trips', 403, 'post', 2009))).rejects.toBeDefined();

        expect(useUserStore.getState().status).toBe('authenticated');
        expect(refreshAccessTokenResult).not.toHaveBeenCalled();
    });
});

describe('회원의 401 — 앱 토큰 갱신 결과', () => {
    beforeEach(() => {
        refreshAccessTokenResult.mockReset();
        clearTokens.mockReset().mockResolvedValue(undefined);
        useUserStore.setState({ status: 'authenticated', userInfo: null, isGuest: false });
    });

    it('서버가 refresh 토큰을 거절하면(rejected) 토큰을 버리고 세션을 끝낸다', async () => {
        refreshAccessTokenResult.mockResolvedValue('rejected');
        const error = denial('/v1/users/me/summary', 401);

        await expect(rejected(error)).rejects.toBe(error);

        expect(clearTokens).toHaveBeenCalledTimes(1);
        expect(useUserStore.getState().status).toBe('unauthenticated');
    });

    /* 지하철처럼 네트워크가 잠깐 끊긴 것만으로 로그아웃되면 안 된다. */
    it('네트워크 끊김·타임아웃·5xx로 갱신하지 못하면(transient) 세션을 지키고 원래 오류를 돌려준다', async () => {
        refreshAccessTokenResult.mockResolvedValue('transient');
        const error = denial('/v1/users/me/summary', 401);

        await expect(rejected(error)).rejects.toBe(error);

        expect(clearTokens).not.toHaveBeenCalled();
        expect(useUserStore.getState().status).toBe('authenticated');
    });

    it('갱신에 성공하면(refreshed) 원래 요청을 다시 보낸다', async () => {
        refreshAccessTokenResult.mockResolvedValue('refreshed');
        const error = denial('/v1/users/me/summary', 401);
        // 재시도가 실제 네트워크를 타지 않도록 어댑터를 바꿔 끼운다
        (error.config as { adapter?: unknown }).adapter = async (config: unknown) => ({
            data: { ok: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
        });

        await expect(rejected(error)).resolves.toEqual({ ok: true });

        expect(clearTokens).not.toHaveBeenCalled();
        expect(useUserStore.getState().status).toBe('authenticated');
    });
});

describe('회원의 401 — 웹 쿠키 갱신 결과', () => {
    beforeEach(() => {
        platform.native = false;
        refreshAccessTokenResult.mockReset();
        clearTokens.mockReset().mockResolvedValue(undefined);
        useUserStore.setState({ status: 'authenticated', userInfo: null, isGuest: false });
    });

    it('서버가 갱신을 거절하면(rejected) 세션을 끝낸다. 웹에는 지울 토큰이 없다', async () => {
        refreshWebSession.mockResolvedValue('rejected');
        const error = denial('/v1/users/me/summary', 401);

        await expect(rejected(error)).rejects.toBe(error);

        expect(useUserStore.getState().status).toBe('unauthenticated');
        expect(clearTokens).not.toHaveBeenCalled();
        expect(refreshAccessTokenResult).not.toHaveBeenCalled();
    });

    it('네트워크 끊김·타임아웃·5xx로 갱신하지 못하면(transient) 세션을 지키고 원래 오류를 돌려준다', async () => {
        refreshWebSession.mockResolvedValue('transient');
        const error = denial('/v1/users/me/summary', 401);

        await expect(rejected(error)).rejects.toBe(error);

        expect(useUserStore.getState().status).toBe('authenticated');
    });

    it('갱신에 성공하면(refreshed) 원래 요청을 다시 보낸다', async () => {
        refreshWebSession.mockResolvedValue('refreshed');
        const error = denial('/v1/users/me/summary', 401);
        (error.config as { adapter?: unknown }).adapter = async (config: unknown) => ({
            data: { ok: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
        });

        await expect(rejected(error)).resolves.toEqual({ ok: true });

        expect(useUserStore.getState().status).toBe('authenticated');
    });

    it('게스트의 401은 갱신 없이 세션을 끝낸다', async () => {
        useUserStore.setState({ isGuest: true });

        await expect(rejected(denial('/v1/users/me/summary', 401))).rejects.toBeDefined();

        expect(refreshWebSession).not.toHaveBeenCalled();
        expect(clearTokens).not.toHaveBeenCalled();
        expect(useUserStore.getState().status).toBe('unauthenticated');
    });

    it('/v1/devices의 401은 갱신도 세션 종료도 하지 않는다', async () => {
        await expect(rejected(denial('/v1/devices', 401))).rejects.toBeDefined();

        expect(refreshWebSession).not.toHaveBeenCalled();
        expect(useUserStore.getState().status).toBe('authenticated');
    });
});

describe('게스트', () => {
    beforeEach(() => {
        refreshAccessTokenResult.mockReset().mockResolvedValue('rejected');
        clearTokens.mockReset().mockResolvedValue(undefined);
        useLoginPromptStore.setState({ isOpen: false });
        useUserStore.setState({ status: 'authenticated', userInfo: null, isGuest: true });
    });

    it('쓰기가 403으로 거절되면 세션을 유지하고 로그인 유도 시트를 연다', async () => {
        const error = await rejected(denial('/v1/trips/abc', 403, 'delete', 2009)).catch((e: unknown) => e);

        expect(isGuestRestrictedError(error)).toBe(true);
        expect(useUserStore.getState().status).toBe('authenticated');
        expect(refreshAccessTokenResult).not.toHaveBeenCalled();
        expect(useLoginPromptStore.getState().isOpen).toBe(true);
    });

    it('401은 체험 만료 — 갱신 없이 세션을 끊는다', async () => {
        await expect(rejected(denial('/v1/users/me/summary', 401))).rejects.toBeDefined();

        expect(refreshAccessTokenResult).not.toHaveBeenCalled();
        expect(clearTokens).toHaveBeenCalledTimes(1);
        expect(useUserStore.getState().status).toBe('unauthenticated');
    });
});
