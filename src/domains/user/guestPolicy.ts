import { AxiosError, InternalAxiosRequestConfig } from 'axios';

/*
 * 게스트(ROLE_GUEST)가 서버에서 할 수 있는 일의 경계.
 *
 * 백엔드 SecurityConfig 기준: GET은 전부 허용, 쓰기(POST/PUT/PATCH/DELETE)는 USER 전용이다.
 * 예외는 공유 수락·거절과 알림 읽음·삭제(PATCH)뿐이다.
 *
 * 서버는 권한 부족에 403(code 2009 ACCESS_DENIED)을 준다(백엔드 cf46882 이전엔 401로 덮였다).
 * 응답 인터셉터가 403을 안전망으로 받지만, 사진을 고르거나 폼을 채운 뒤에 막히면 수고가 버려진다.
 * 그래서 요청을 보내기 전에 막는다 — 서버 왕복 없이 바로 로그인 유도 시트를 띄운다.
 */
const GUEST_WRITABLE: { method: string; path: string }[] = [
    { method: '*', path: '/v1/auth/' }, // 로그인·로그아웃·refresh
    { method: '*', path: '/v1/devices' }, // 배경 요청. 인터셉터가 세션과 무관하게 처리한다.
    { method: 'patch', path: '/v1/shares/' },
    { method: 'patch', path: '/v1/notifications/' },
];

export const isGuestRestricted = (config?: Pick<InternalAxiosRequestConfig, 'method' | 'url'>) => {
    const method = (config?.method ?? 'get').toLowerCase();
    if (method === 'get' || method === 'head' || method === 'options') return false;

    const url = config?.url ?? '';
    return !GUEST_WRITABLE.some((rule) => (rule.method === '*' || rule.method === method) && url.includes(rule.path));
};

export const GUEST_RESTRICTED_CODE = 'ERR_GUEST_RESTRICTED';

export const createGuestRestrictedError = (config: InternalAxiosRequestConfig) =>
    new AxiosError('게스트는 이 요청을 보낼 수 없습니다.', GUEST_RESTRICTED_CODE, config);

/** 로그인 유도 시트가 이미 떠 있으므로 호출부는 별도 토스트를 띄우지 않아야 한다. */
export const isGuestRestrictedError = (error: unknown) =>
    error instanceof AxiosError && error.code === GUEST_RESTRICTED_CODE;
