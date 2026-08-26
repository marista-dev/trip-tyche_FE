import { AxiosError } from 'axios';
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

const denial = (url: string, status: 401 | 403) =>
    ({
        config: { url, headers: {} },
        request: {},
        response: { status, data: { status, code: 1001, message: '인증이 필요합니다.' } },
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
        await expect(rejected(denial('/v1/users/me/summary', 401))).rejects.toBeDefined();

        expect(refreshAccessToken).toHaveBeenCalled();
        expect(useUserStore.getState().status).toBe('unauthenticated');
    });

    it('그 외 경로의 403은 세션을 끊는다', async () => {
        await expect(rejected(denial('/v1/trips', 403))).rejects.toBeDefined();

        expect(useUserStore.getState().status).toBe('unauthenticated');
    });
});
