import axios, { isAxiosError } from 'axios';

import { API_BASE_URL } from '@/libs/apis/shared/constants';

/*
 * 세션 갱신 결과의 공통 분류. 웹(쿠키)과 앱(저장된 토큰)이 같은 기준을 쓴다.
 * - refreshed: 갱신됐다. 원래 요청을 다시 보낸다.
 * - rejected: 서버가 거절했다(만료·폐기·세션 없음). 세션을 끝낸다.
 * - transient: 네트워크 끊김·타임아웃·5xx처럼 재시도하면 풀릴 수 있다. 세션을 지키고 나중에 다시 시도한다.
 */
export type RefreshResult = 'refreshed' | 'rejected' | 'transient';

// 4xx여도 재시도하면 되는 상태(요청 시간 초과·호출 제한)는 인증 거부로 보지 않는다
const RETRYABLE_CLIENT_ERROR_STATUSES = [408, 429];

// 서버가 갱신을 거절한 경우만 true. 응답이 없는 네트워크 오류·타임아웃·5xx는 재시도로 풀릴 수 있다
export const isAuthRejection = (error: unknown): boolean => {
    if (!isAxiosError(error) || !error.response) return false;

    const { status } = error.response;
    return status >= 400 && status < 500 && !RETRYABLE_CLIENT_ERROR_STATUSES.includes(status);
};

/*
 * refresh 토큰은 갱신할 때마다 회전하고 옛 토큰은 짧은 유예 뒤 폐기된다.
 * 동시에 갱신하면(병렬 401, 소켓 재연결) 늦은 쪽이 실패해 로그아웃될 수 있으므로,
 * 진행 중인 요청 하나를 모든 호출자가 공유한다. 반환한 함수는 reject하지 않아야 한다.
 */
export const shareInFlight = (request: () => Promise<RefreshResult>) => {
    let inFlight: Promise<RefreshResult> | null = null;

    return (): Promise<RefreshResult> => {
        inFlight ??= request().finally(() => {
            inFlight = null;
        });
        return inFlight;
    };
};

// 웹은 refresh 토큰이 HttpOnly 쿠키라 body에 싣지 않고 쿠키로 갱신한다
const requestCookieRefresh = async (): Promise<RefreshResult> => {
    try {
        await axios.post(`${API_BASE_URL}/v1/auth/refresh`, {}, { withCredentials: true });
        return 'refreshed';
    } catch (error) {
        console.warn('세션 갱신 실패: ', error);
        return isAuthRejection(error) ? 'rejected' : 'transient';
    }
};

export const refreshWebSession = shareInFlight(requestCookieRefresh);
