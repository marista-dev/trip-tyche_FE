import { Preferences } from '@capacitor/preferences';

/*
 * 네이티브 앱의 인증 토큰 저장소.
 *
 * 웹은 HttpOnly 쿠키로 세션을 유지하지만, WebView에서는 그 쿠키가 살아남지 않는다.
 * (실측: /v1/auth/guest가 200으로 토큰을 발급해도 다음 요청이 401)
 * 그래서 앱에서는 토큰을 직접 보관하고 Authorization 헤더로 실어 보낸다.
 *
 * 백엔드의 JWTAuthenticationFilter는 이미 Bearer 헤더를 쿠키보다 먼저 확인하므로,
 * 보호 API는 서버 변경 없이 이 방식으로 동작한다.
 */

const ACCESS_TOKEN_KEY = 'triptyche.accessToken';

/*
 * 매 요청마다 Preferences를 await하지 않도록 메모리에 캐시한다.
 * 저장소가 진실의 원천이고 이 값은 그 사본이므로, 쓰기는 항상 둘을 함께 갱신한다.
 */
let cachedAccessToken: string | null = null;

// 앱 시작 시 1회 호출해 저장된 토큰을 메모리로 끌어올린다.
export const hydrateAccessToken = async (): Promise<string | null> => {
    try {
        const { value } = await Preferences.get({ key: ACCESS_TOKEN_KEY });
        cachedAccessToken = value ?? null;
    } catch (error) {
        console.warn('토큰 불러오기 실패: ', error);
        cachedAccessToken = null;
    }

    return cachedAccessToken;
};

// 인터셉터가 동기적으로 읽는다. hydrate 전이면 null이다.
export const getAccessToken = (): string | null => cachedAccessToken;

export const saveAccessToken = async (token: string): Promise<void> => {
    cachedAccessToken = token;

    try {
        await Preferences.set({ key: ACCESS_TOKEN_KEY, value: token });
    } catch (error) {
        // 저장에 실패해도 메모리 캐시는 살아 있어 현재 세션은 유지된다. 재시작 시에만 풀린다.
        console.warn('토큰 저장 실패: ', error);
    }
};

export const clearAccessToken = async (): Promise<void> => {
    cachedAccessToken = null;

    try {
        await Preferences.remove({ key: ACCESS_TOKEN_KEY });
    } catch (error) {
        console.warn('토큰 삭제 실패: ', error);
    }
};
