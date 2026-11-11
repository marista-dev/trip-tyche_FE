import { AxiosError } from 'axios';

import { isGuestRestrictedError } from '@/domains/user/guestPolicy';
import { ApiResponse, Result } from '@/libs/apis/shared/types';
import { MESSAGE } from '@/shared/constants/ui';

export const toResult = async <T, R = T>(
    fn: () => Promise<ApiResponse<T>>,
    callback?: {
        onSuccess?: () => void;
        onError?: () => void;
        onFinally?: () => void;
        /** 응답 data(T)에서 실제로 노출할 값을 뽑아내는 변환. 생략 시 data를 그대로 반환한다. */
        transform?: (data: T) => R;
        /** 서버가 에러 메시지를 주지 않을 때 사용할 연산별 기본 메시지. 생략 시 공통 UNKNOWN 메시지. */
        errorMessage?: string;
    },
): Promise<Result<R>> => {
    const { onSuccess, onError, onFinally, transform, errorMessage } = callback || {};
    try {
        const { data } = await fn();
        onSuccess?.();
        const value = (transform ? transform(data) : data) as R;
        return { success: true, data: value };
    } catch (error) {
        // 로그인 유도 시트가 이미 떴다 — 빈 메시지로 호출부 토스트를 막는다.
        if (isGuestRestrictedError(error)) {
            onError?.();
            return { success: false, error: '' };
        }
        if (error instanceof AxiosError) {
            const errorResponse = error?.response?.data;
            onError?.();
            // 네트워크 단절(ERR_NETWORK)처럼 응답 자체가 없는 경우 errorResponse가 undefined가 되므로
            // .message 직접 접근하면 TypeError로 toResult 자체가 reject되어 unhandled rejection 발생.
            return { success: false, error: errorResponse?.message ?? errorMessage ?? MESSAGE.ERROR.UNKNOWN };
        }
        return { success: false, error: errorMessage ?? MESSAGE.ERROR.UNKNOWN };
    } finally {
        onFinally?.();
    }
};
