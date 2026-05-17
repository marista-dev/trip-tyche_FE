import { AxiosError } from 'axios';

import { ApiResponse, Result } from '@/libs/apis/shared/types';
import { MESSAGE } from '@/shared/constants/ui';

export const toResult = async <T>(
    fn: () => Promise<ApiResponse<T>>,
    callback?: {
        onSuccess?: () => void;
        onError?: () => void;
        onFinally?: () => void;
    },
): Promise<Result<T>> => {
    const { onSuccess, onError, onFinally } = callback || {};
    try {
        const { data } = await fn();
        onSuccess?.();
        return { success: true, data };
    } catch (error) {
        if (error instanceof AxiosError) {
            const errorResponse = error?.response?.data;
            onError?.();
            // 네트워크 단절(ERR_NETWORK)처럼 응답 자체가 없는 경우 errorResponse가 undefined가 되므로
            // .message 직접 접근하면 TypeError로 toResult 자체가 reject되어 unhandled rejection 발생.
            return { success: false, error: errorResponse?.message ?? MESSAGE.ERROR.UNKNOWN };
        }
        return { success: false, error: MESSAGE.ERROR.UNKNOWN };
    } finally {
        onFinally?.();
    }
};
