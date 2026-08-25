import { Preferences } from '@capacitor/preferences';
import axios from 'axios';

import { API_BASE_URL } from '@/libs/apis/shared/constants';

/*
 * 네이티브 앱의 인증 토큰 저장소 + 갱신·교환 창구.
 *
 * 웹은 HttpOnly 쿠키로 세션을 유지하지만 WebView에서는 그 쿠키가 살아남지 않는다.
 * (실측: /v1/auth/guest가 200으로 토큰을 발급해도 다음 요청이 401)
 * 그래서 앱에서는 토큰을 직접 보관하고 Authorization 헤더로 실어 보낸다.
 *
 * apiClient가 아니라 axios를 직접 쓰는 이유: apiClient의 인터셉터가 이 모듈을 참조하므로
 * 순환 의존이 생긴다. 토큰 교환·갱신은 인증이 필요 없는 요청이라 raw axios로 충분하다.
 */

const ACCESS_TOKEN_KEY = 'triptyche.accessToken';
const REFRESH_TOKEN_KEY = 'triptyche.refreshToken';

/*
 * 매 요청마다 Preferences를 await하지 않도록 메모리에 캐시한다.
 * 저장소가 진실의 원천이고 이 값은 사본이므로, 쓰기는 항상 둘을 함께 갱신한다.
 */
let cachedAccessToken: string | null = null;
let cachedRefreshToken: string | null = null;

export interface AuthTokens {
    accessToken: string;
    refreshToken?: string;
}

// 앱 시작 시 1회 호출해 저장된 토큰을 메모리로 끌어올린다.
export const hydrateTokens = async (): Promise<string | null> => {
    try {
        const [access, refresh] = await Promise.all([
            Preferences.get({ key: ACCESS_TOKEN_KEY }),
            Preferences.get({ key: REFRESH_TOKEN_KEY }),
        ]);
        cachedAccessToken = access.value ?? null;
        cachedRefreshToken = refresh.value ?? null;
    } catch (error) {
        console.warn('토큰 불러오기 실패: ', error);
        cachedAccessToken = null;
        cachedRefreshToken = null;
    }

    return cachedAccessToken;
};

// 인터셉터가 동기적으로 읽는다. hydrate 전이면 null이다.
export const getAccessToken = (): string | null => cachedAccessToken;

export const saveTokens = async ({ accessToken, refreshToken }: AuthTokens): Promise<void> => {
    cachedAccessToken = accessToken;
    if (refreshToken) cachedRefreshToken = refreshToken;

    try {
        await Preferences.set({ key: ACCESS_TOKEN_KEY, value: accessToken });
        if (refreshToken) await Preferences.set({ key: REFRESH_TOKEN_KEY, value: refreshToken });
    } catch (error) {
        // 저장에 실패해도 메모리 캐시는 살아 있어 현재 세션은 유지된다. 재시작 시에만 풀린다.
        console.warn('토큰 저장 실패: ', error);
    }
};

// 게스트·DEV 로그인처럼 access 토큰만 내려오는 경로용.
export const saveAccessToken = async (accessToken: string): Promise<void> => saveTokens({ accessToken });

export const clearTokens = async (): Promise<void> => {
    cachedAccessToken = null;
    cachedRefreshToken = null;

    try {
        await Promise.all([
            Preferences.remove({ key: ACCESS_TOKEN_KEY }),
            Preferences.remove({ key: REFRESH_TOKEN_KEY }),
        ]);
    } catch (error) {
        console.warn('토큰 삭제 실패: ', error);
    }
};

/*
 * OAuth 딥링크로 받은 1회용 code를 토큰으로 교환한다.
 * 딥링크 URL에 토큰을 직접 실으면 OS 로그·리퍼러에 장기 토큰이 남을 수 있어, 짧은 code만 주고받는다.
 */
export const exchangeCodeForTokens = async (code: string): Promise<boolean> => {
    try {
        const { data } = await axios.post(`${API_BASE_URL}/v1/auth/token/exchange`, { code });
        const tokens = data?.data;

        if (!tokens?.accessToken) {
            console.error('토큰 교환 응답에 accessToken이 없습니다.');
            return false;
        }

        await saveTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
        return true;
    } catch (error) {
        console.error('토큰 교환 실패: ', error);
        return false;
    }
};

/*
 * 저장된 refresh 토큰으로 access 토큰을 재발급한다.
 * 앱에는 갱신에 쓸 쿠키가 없으므로 body로 보낸다.
 */
export const refreshAccessToken = async (): Promise<boolean> => {
    if (!cachedRefreshToken) return false;

    try {
        const { data } = await axios.post(`${API_BASE_URL}/v1/auth/token/refresh`, {
            refreshToken: cachedRefreshToken,
        });
        const tokens = data?.data;

        if (!tokens?.accessToken) return false;

        await saveTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
        return true;
    } catch (error) {
        console.warn('토큰 갱신 실패: ', error);
        return false;
    }
};
