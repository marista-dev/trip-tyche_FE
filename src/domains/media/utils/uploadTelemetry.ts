import { isAxiosError } from 'axios';

/*
 * 업로드 추적 이벤트(upload_started / upload_finished / upload_backgrounded / photos_picked)에 싣는 값을 만든다.
 *
 * 개인정보 원칙(src/libs/analytics.ts)과 같다: 파일명·tripKey·URL·오류 메시지는 싣지 않는다.
 * 오류는 메시지 대신 아래 분류값으로만 보낸다. presigned URL이 오류 메시지·config에 그대로 들어 있기 때문이다.
 */

/** 업로드가 시작된 화면. 같은 훅을 두 화면이 쓴다. */
export type UploadSource = 'create' | 'manage';

/**
 * 체인이 멈춘 단계.
 * prepare = EXIF 읽기 등 준비, presign = URL 발급, s3 = 파일 전송, register = 메타데이터 등록, post_task = 상태 전환
 */
export type UploadStage = 'prepare' | 'presign' | 's3' | 'register' | 'post_task';

/** 업로드 체인이 다시 돌기 시작한 계기. allow_duplicates = 중복으로 빠진 사진을 '그래도 올리기' */
export type UploadTrigger = 'initial' | 'manual_retry' | 'online_retry' | 'allow_duplicates';

export type UploadFailureKind =
    | 'stall_timeout'
    | 'wall_clock_timeout'
    | 'aborted'
    | 'network'
    | 'http_4xx'
    | 'http_5xx'
    | 'unknown';

/** uploadToS3가 스스로 끊은 이유. 외부(오프라인·재시도) 취소는 'external'이다. */
export type UploadAbortReason = 'stall' | 'wall_clock' | 'external';

/** uploadToS3가 자기 타이머나 외부 신호로 요청을 끊었을 때 던진다. 끊은 이유를 분류에 쓰려고 따로 둔다. */
export class UploadAbortError extends Error {
    readonly reason: UploadAbortReason;

    constructor(reason: UploadAbortReason) {
        super(`upload aborted: ${reason}`);
        this.name = 'UploadAbortError';
        this.reason = reason;
    }
}

/** axios를 거치지 않는 S3 직접 전송(XHR)의 실패. 응답이 없었으면 status가 null이다. */
export class UploadHttpError extends Error {
    readonly status: number | null;

    constructor(status: number | null) {
        super(status === null ? 'upload network error' : `upload failed: ${status}`);
        this.name = 'UploadHttpError';
        this.status = status;
    }
}

const classifyStatus = (status: number | null | undefined): UploadFailureKind | null => {
    if (status && status >= 500) return 'http_5xx';
    if (status && status >= 400) return 'http_4xx';
    return null;
};

export const classifyUploadError = (error: unknown): UploadFailureKind => {
    if (error instanceof UploadAbortError) {
        if (error.reason === 'stall') return 'stall_timeout';
        if (error.reason === 'wall_clock') return 'wall_clock_timeout';
        return 'aborted';
    }
    if (error instanceof UploadHttpError) return classifyStatus(error.status) ?? 'network';
    if (isAxiosError(error)) {
        if (error.code === 'ERR_CANCELED') return 'aborted';
        const byStatus = classifyStatus(error.response?.status);
        if (byStatus) return byStatus;
        // 응답 없이 실패 = 연결 자체가 안 됨(오프라인, DNS, CORS 거부 포함)
        if (!error.response) return 'network';
    }
    return 'unknown';
};

export type FailureCounts = Record<UploadFailureKind, number>;

export const emptyFailureCounts = (): FailureCounts => ({
    stall_timeout: 0,
    wall_clock_timeout: 0,
    aborted: 0,
    network: 0,
    http_4xx: 0,
    http_5xx: 0,
    unknown: 0,
});

/** 이벤트 속성용으로 펼친다. PostHog에서 속성 하나씩 필터·합산할 수 있게 fail_<kind> 평면 키로 보낸다. */
export const flattenFailureCounts = (counts: FailureCounts) =>
    Object.fromEntries(Object.entries(counts).map(([kind, n]) => [`fail_${kind}`, n]));

/** 같은 업로드의 시작·종료 이벤트를 잇는 키. 사용자·파일과 무관한 난수다. */
export const createUploadId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};
