import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';

import {
    classifyUploadError,
    emptyFailureCounts,
    flattenFailureCounts,
    UploadAbortError,
    UploadHttpError,
} from '@/domains/media/utils/uploadTelemetry';
import { toMb } from '@/libs/utils/image';

const axiosErrorWithStatus = (status: number) => {
    const config = { headers: new AxiosHeaders() };
    const response = { status, statusText: '', headers: {}, config, data: null } as AxiosResponse;
    return new AxiosError('failed', 'ERR_BAD_RESPONSE', config, null, response);
};

describe('classifyUploadError', () => {
    it('uploadToS3가 스스로 끊은 이유를 정지·시간 초과·외부 취소로 나눈다', () => {
        expect(classifyUploadError(new UploadAbortError('stall'))).toBe('stall_timeout');
        expect(classifyUploadError(new UploadAbortError('wall_clock'))).toBe('wall_clock_timeout');
        expect(classifyUploadError(new UploadAbortError('external'))).toBe('aborted');
    });

    it('응답 상태로 4xx·5xx를 나눈다', () => {
        expect(classifyUploadError(axiosErrorWithStatus(403))).toBe('http_4xx');
        expect(classifyUploadError(axiosErrorWithStatus(503))).toBe('http_5xx');
    });

    it('응답이 없으면 network, axios 취소는 aborted다', () => {
        expect(classifyUploadError(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe('network');
        expect(classifyUploadError(new AxiosError('canceled', 'ERR_CANCELED'))).toBe('aborted');
    });

    it('S3 직접 전송 실패는 상태로 나누고, 응답이 없으면 network다', () => {
        expect(classifyUploadError(new UploadHttpError(403))).toBe('http_4xx');
        expect(classifyUploadError(new UploadHttpError(502))).toBe('http_5xx');
        expect(classifyUploadError(new UploadHttpError(null))).toBe('network');
    });

    it('그 밖의 값은 unknown이다', () => {
        expect(classifyUploadError(new Error('boom'))).toBe('unknown');
        expect(classifyUploadError('boom')).toBe('unknown');
    });
});

describe('이벤트 속성 헬퍼', () => {
    it('실패 분류를 fail_<kind> 평면 키로 펼친다', () => {
        const counts = emptyFailureCounts();
        counts.network = 2;
        expect(flattenFailureCounts(counts)).toEqual({
            fail_stall_timeout: 0,
            fail_wall_clock_timeout: 0,
            fail_aborted: 0,
            fail_network: 2,
            fail_http_4xx: 0,
            fail_http_5xx: 0,
            fail_file_unreadable: 0,
            fail_unknown: 0,
        });
    });

    it('바이트를 소수 첫째 자리 MB로 바꾼다', () => {
        expect(toMb(12_345_678)).toBe(12.3);
        expect(toMb(0)).toBe(0);
    });
});
