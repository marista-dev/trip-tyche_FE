import { apiClient } from '@/libs/apis/shared/client';
import { ApiResponse } from '@/libs/apis/shared/types';

/*
 * FCM 디바이스 토큰 등록·해제. 네이티브 앱 전용이다.
 *
 * 서버가 upsert로 처리하므로 같은 토큰을 반복 등록해도 행이 늘지 않는다.
 * FCM 토큰은 앱 재설치·데이터 삭제·장기 미사용(270일)으로 갱신되고 서버가 무효 토큰을 지우므로,
 * 로그인할 때마다 등록해 두면 자동으로 복구된다.
 */
export const deviceAPI = {
    register: async (token: string, appVersion: string): Promise<ApiResponse<string>> =>
        await apiClient.post('/v1/devices', { token, platform: 'ANDROID', appVersion }),

    unregister: async (token: string): Promise<ApiResponse<string>> =>
        await apiClient.delete(`/v1/devices/${encodeURIComponent(token)}`),
};
