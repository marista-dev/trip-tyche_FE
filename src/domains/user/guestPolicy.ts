import { AxiosError, InternalAxiosRequestConfig } from 'axios';

/** 게스트 계정이 유지되는 시간(서버 GuestCleanupScheduler와 같은 값) */
export const GUEST_TTL_HOURS = 4;

const GUEST_RESTRICTED_CODE = 'ERR_GUEST_RESTRICTED';

/** 게스트의 쓰기 요청이 403으로 거절됐을 때. 로그인 유도 시트가 이미 떠 있으므로 호출부는 토스트를 띄우지 않는다. */
export const createGuestRestrictedError = (config: InternalAxiosRequestConfig) =>
    new AxiosError('게스트는 이 요청을 보낼 수 없습니다.', GUEST_RESTRICTED_CODE, config);

export const isGuestRestrictedError = (error: unknown) =>
    error instanceof AxiosError && error.code === GUEST_RESTRICTED_CODE;
