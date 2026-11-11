import { useEffect, useRef } from 'react';

import useUserStore from '@/domains/user/stores/useUserStore';
import {
    ANALYTICS_EVENTS,
    consumeLoginProvider,
    consumeSignupQuery,
    flushPendingEvents,
    identifyUser,
    queuePendingEvent,
} from '@/libs/analytics';
import { userAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';
import { registerDeviceToken } from '@/platform/native/push';
import Indicator from '@/shared/components/common/Spinner/Indicator';

/**
 * 앱 부팅 시 한 번 인증 상태를 확인하고 store에 반영한다.
 *
 * - 마운트 시 `/users/me/summary` 호출
 *   - 200 → store.login(user) → status = 'authenticated'
 *   - 401/네트워크 실패 → store.setUnauthenticated() → status = 'unauthenticated'
 * - 그 외 시점의 상태 변경은 store의 login/logout/setUnauthenticated를 통해서만 일어난다.
 * - status === 'unknown' 동안엔 로딩만 보여 protected 페이지가 마운트되며 401 사이클을 시작하는 것을 방지한다.
 */
const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const status = useUserStore((s) => s.status);
    const login = useUserStore((s) => s.login);
    const setUnauthenticated = useUserStore((s) => s.setUnauthenticated);
    const bootstrappedRef = useRef(false);

    useEffect(() => {
        if (bootstrappedRef.current) return;
        bootstrappedRef.current = true;

        let cancelled = false;
        (async () => {
            const result = await toResult(() => userAPI.fetchUserInfo());
            if (cancelled) return;

            if (result.success) {
                login(result.data);
                /*
                 * 디바이스 등록은 인증이 필요하다. 여기가 앱에서 인증이 확정되는 유일한 지점이다.
                 * 다만 게스트는 제외한다 — ROLE_GUEST에는 POST /v1/devices 권한이 없어 401이 나고,
                 * 4시간 뒤 사라질 계정이라 토큰을 등록할 이유도 없다.
                 */
                if (result.data?.role !== 'GUEST') void registerDeviceToken();

                /*
                 * 분석 identify도 여기서만 한다. 로그인·게스트 진입은 모두 전체 새로고침으로 끝나므로
                 * 인증이 확정되는 시점은 이 부팅 한 곳뿐이다.
                 * 실패 분기에서는 아무것도 하지 않는다 — 비로그인 방문자는 부팅마다 거기로 오는데,
                 * 여기서 reset하면 익명 id가 매번 바뀌어 랜딩 퍼널이 끊긴다.
                 */
                if (result.data) {
                    // 재로그인에서도 꺼내 지운다. 남겨 두면 나중의 가입에 이전 provider가 붙는다.
                    const provider = consumeLoginProvider() ?? undefined;
                    // 웹 신규 가입: 백엔드가 리다이렉트 URL에 붙인 ?signup=true. 읽는 즉시 URL에서 지워 새로고침 중복을 막는다.
                    if (consumeSignupQuery()) {
                        queuePendingEvent(ANALYTICS_EVENTS.SIGNED_UP, { provider });
                    }
                    // 객체를 통째로 넘기지 않고 세 필드만 꺼낸다. 닉네임 등이 실수로 PostHog에 실리는 것을 막는다.
                    const { userId, role, createdAt } = result.data;
                    identifyUser({ userId, role, createdAt });
                    // 보류 이벤트(signed_up, guest_started)는 identify가 끝난 뒤에 보내야 해당 사용자에게 귀속된다.
                    flushPendingEvents();
                }
            } else {
                setUnauthenticated();
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [login, setUnauthenticated]);

    if (status === 'unknown') {
        return <Indicator />;
    }

    return <>{children}</>;
};

export default AuthProvider;
