import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import useUserStore from '@/domains/user/stores/useUserStore';
import { apiClient } from '@/libs/apis/shared/client';
import { API_BASE_URL } from '@/libs/apis/shared/constants';
import { ApiResponse } from '@/libs/apis/shared/types';
import { isNative } from '@/platform';
import { clearAccessToken, getAccessToken } from '@/platform/native/auth';
import { useToastStore } from '@/shared/stores/useToastStore';

interface CustomRequestConfing extends InternalAxiosRequestConfig {
    isAlreadyRequest?: boolean;
}

export const setupRequestInterceptor = (instance: AxiosInstance) => {
    instance.interceptors.request.use(
        (config: InternalAxiosRequestConfig) => {
            const { isLoggingOut } = useUserStore.getState();

            if (isLoggingOut && !config.url?.includes('/auth/logout')) {
                const controller = new AbortController();
                controller.abort();
                return {
                    ...config,
                    signal: controller.signal,
                };
            }

            // 앱에서는 쿠키가 살아남지 않으므로 저장된 토큰을 헤더로 싣는다.
            if (isNative()) {
                const accessToken = getAccessToken();
                if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
            }

            return config;
        },
        (error: AxiosError) => {
            return Promise.reject(error);
        },
    );
};

/**
 * 응답 인터셉터.
 *
 * 설계 원칙:
 * - 인증 실패(401)는 refresh 1회 시도 후 실패 시 store status를 `unauthenticated`로 설정만 한다.
 *   라우터의 `<RequireAuth>`가 status를 보고 navigate한다 — 인터셉터가 직접 logout/redirect하지 않는다.
 * - `apiClient.post('/v1/auth/logout')`을 인터셉터에서 호출하지 않는다 (재진입 무한루프 방지).
 * - 실패 응답은 `Promise.reject`로 일관되게 전파한다 (Promise.resolve({}) 트릭 금지).
 */
export const setupResponseInterceptor = (instance: AxiosInstance) => {
    instance.interceptors.response.use(
        (response) => {
            return response.data;
        },
        async (error: AxiosError<ApiResponse<null>>) => {
            const { showToast } = useToastStore.getState();

            const originalRequest = error.config as CustomRequestConfing;

            if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
                showToast('네트워크 연결을 확인해주세요.');
                return Promise.reject(error);
            }

            if (error.request && !error.response) {
                showToast('서버와의 연결이 원활하지 않습니다.');
                return Promise.reject(error);
            }

            if (error.response && originalRequest && !originalRequest.isAlreadyRequest) {
                originalRequest.isAlreadyRequest = true;
                const httpStatus = error.response.status;
                const { status } = error.response.data ?? {};

                if (status === 401) {
                    /*
                     * 앱에는 갱신할 쿠키가 없다. 현행 /v1/auth/refresh는 refresh 토큰을 쿠키에서만
                     * 읽으므로(백엔드 M1에서 body 기반 경로가 생긴다), 지금은 토큰을 버리고
                     * 로그인 화면으로 보낸다.
                     */
                    if (isNative()) {
                        await clearAccessToken();
                        useUserStore.getState().setUnauthenticated();
                        return Promise.reject(error);
                    }

                    try {
                        await axios.post(`${API_BASE_URL}/v1/auth/refresh`, {}, { withCredentials: true });
                        return apiClient(originalRequest);
                    } catch {
                        // 세션 만료 — 라우터 가드가 redirect를 책임진다.
                        useUserStore.getState().setUnauthenticated();
                        return Promise.reject(error);
                    }
                }

                if (status === 403) {
                    useUserStore.getState().setUnauthenticated();
                    return Promise.reject(error);
                }

                if (status === 500) {
                    if (error.response.data) {
                        error.response.data.message = '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요';
                    }
                    return Promise.reject(error);
                }

                if (status === undefined && httpStatus >= 500) {
                    return Promise.reject(error);
                }
            }

            return Promise.reject(error);
        },
    );
};
