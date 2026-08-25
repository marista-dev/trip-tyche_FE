import { useEffect, useRef } from 'react';

import useUserStore from '@/domains/user/stores/useUserStore';
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
                // 디바이스 등록은 인증이 필요하다. 여기가 앱에서 인증이 확정되는 유일한 지점이다.
                void registerDeviceToken();
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
