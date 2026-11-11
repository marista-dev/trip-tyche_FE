import { create } from 'zustand';

import { UserInfo } from '@/domains/user/types';
import { resetAnalytics } from '@/libs/analytics';
import { userAPI } from '@/libs/apis';
import { isNative } from '@/platform';
import { clearTokens } from '@/platform/native/auth';
import { unregisterDeviceToken } from '@/platform/native/push';
import { queryClient } from '@/shared/providers/TanStackProvider';

export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';

interface UserState {
    status: AuthStatus;
    isLoggingOut: boolean;
    isGuest: boolean;
    userInfo: UserInfo | null;
    updateNickname: (nickname: string) => void;
    loginAsGuest: () => Promise<void>;
    login: (userInfo: UserInfo) => void;
    logout: () => Promise<void>;
    setUnauthenticated: () => void;
}

const useUserStore = create<UserState>()((set, get) => ({
    status: 'unknown',
    isLoggingOut: false,
    isGuest: false,
    userInfo: null,
    updateNickname: (nickname: string) => {
        const { userInfo } = get();
        if (!userInfo) return;

        set(() => ({
            userInfo: {
                ...userInfo,
                nickname,
            },
        }));
    },
    loginAsGuest: async () => {
        await userAPI.postGuestLogin();
    },
    login: (userInfo: UserInfo) => {
        /*
         * toResult는 응답 body가 비어도 success로 판정하므로(`const { data } = await fn()`),
         * 호출부가 success를 확인해도 userInfo가 undefined로 넘어올 수 있다.
         * 여기서 예외가 나면 AuthProvider가 렌더를 끝내지 못해 앱 전체가 로딩 화면에 갇힌다.
         * 인증 정보가 없는 것이므로 미인증으로 떨어뜨린다 — 라우터 가드가 로그인으로 보낸다.
         */
        if (!userInfo) {
            console.error('로그인 처리 실패: 사용자 정보가 비어 있습니다.');
            get().setUnauthenticated();
            return;
        }

        set({
            status: 'authenticated',
            userInfo,
            isGuest: userInfo.role === 'GUEST',
        });
    },
    /**
     * 명시적 로그아웃 (사용자 액션).
     * - 서버 세션 종료 + 클라이언트 상태 초기화.
     * - redirect는 호출자가 책임 (라우터 navigate 사용 권장).
     */
    logout: async () => {
        set(() => ({ isLoggingOut: true }));

        try {
            // 순서가 중요하다 — 로그아웃 뒤에는 Bearer 토큰이 없어 디바이스 해제가 401이 난다.
            await unregisterDeviceToken();
            await userAPI.requestLogout();
        } catch {
            // API 실패해도 클라이언트 세션은 반드시 초기화
        } finally {
            // 앱은 토큰을 기기에 둔다 — 지우지 않으면 재실행 시 이전 계정으로 되살아난다.
            if (isNative()) await clearTokens();
            queryClient.clear();
            set(() => ({
                userInfo: null,
                isLoggingOut: false,
                status: 'unauthenticated',
                isGuest: false,
            }));
            /*
             * 분석 id 초기화는 명시적 로그아웃에서만 한다. setUnauthenticated에서 하면 안 된다 —
             * 비로그인 방문자는 부팅마다 setUnauthenticated를 타므로 익명 id가 매번 바뀌어 랜딩 퍼널이 끊긴다.
             * 상태 초기화 뒤에 둬서, 분석 쪽 문제가 로그아웃 자체를 막지 못하게 한다.
             */
            resetAnalytics();
        }
    },
    /**
     * 세션 만료 등으로 인증이 끊긴 경우 호출.
     * 인터셉터 / AuthProvider가 사용. API 호출 없이 상태만 업데이트.
     */
    setUnauthenticated: () => {
        if (get().status === 'unauthenticated') return;
        queryClient.clear();
        set(() => ({
            userInfo: null,
            isGuest: false,
            status: 'unauthenticated',
        }));
    },
}));

export default useUserStore;
