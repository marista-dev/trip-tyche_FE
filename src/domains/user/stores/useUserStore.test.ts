import { describe, it, expect, beforeEach, vi } from 'vitest';

import useUserStore from './useUserStore';
import type { UserInfo } from '@/domains/user/types';

vi.mock('@/libs/apis/user', () => ({
    userAPI: { requestLogout: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/libs/queryClient', () => ({
    queryClient: { clear: vi.fn() },
}));

const USER: UserInfo = {
    userId: 1,
    nickname: '테스터',
    role: 'USER',
} as UserInfo;

describe('useUserStore.login', () => {
    beforeEach(() => {
        useUserStore.setState({ status: 'unknown', userInfo: null, isGuest: false });
    });

    it('정상 사용자 정보로 인증 상태가 된다', () => {
        useUserStore.getState().login(USER);

        const { status, userInfo, isGuest } = useUserStore.getState();
        expect(status).toBe('authenticated');
        expect(userInfo).toEqual(USER);
        expect(isGuest).toBe(false);
    });

    it('GUEST 역할이면 isGuest가 true다', () => {
        useUserStore.getState().login({ ...USER, role: 'GUEST' });

        expect(useUserStore.getState().isGuest).toBe(true);
    });

    it('사용자 정보가 비어 있어도 예외를 던지지 않고 미인증으로 떨어진다', () => {
        // toResult가 빈 body를 success로 판정하면 undefined가 넘어온다.
        // 여기서 던지면 AuthProvider가 렌더를 끝내지 못해 앱이 로딩 화면에 갇힌다.
        expect(() => useUserStore.getState().login(undefined as unknown as UserInfo)).not.toThrow();

        const { status, userInfo } = useUserStore.getState();
        expect(status).toBe('unauthenticated');
        expect(userInfo).toBeNull();
    });
});
