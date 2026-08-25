import axios from 'axios';

import { API_BASE_URL } from '@/libs/apis/shared/constants';
import { setupRequestInterceptor, setupResponseInterceptor } from '@/libs/apis/shared/interceptors';
import { isNative } from '@/platform';

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10 * 1000,
    // 네이티브 WebView에서는 HttpOnly 쿠키가 유지되지 않아 Bearer 헤더로 대체한다.
    withCredentials: !isNative(),
});

setupRequestInterceptor(apiClient);
setupResponseInterceptor(apiClient);
