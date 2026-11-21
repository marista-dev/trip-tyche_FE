import type { Dispatch, SetStateAction } from 'react';

import { DEFAULT_METADATA } from '@/domains/media/constants';
import { useUploadSessionStore } from '@/domains/media/stores/useUploadSessionStore';
import type { ClientImageFile, MediaFileItem, MediaRequestItem } from '@/domains/media/types';
import {
    ensureFreshTarget,
    isPendingTransfer,
    presignFiles,
    renewTargets,
    type PresignFailure,
    type UploadTarget,
} from '@/domains/media/utils/uploadTargets';
import {
    classifyUploadError,
    createUploadId,
    emptyFailureCounts,
    flattenFailureCounts,
    UploadAbortError,
    type FailureCounts,
    type UploadSource,
    type UploadStage,
    type UploadTrigger,
} from '@/domains/media/utils/uploadTelemetry';
import type { UploadRejectReason } from '@/domains/media/utils/uploadValidation';
import { ANALYTICS_EVENTS, track } from '@/libs/analytics';
import { mediaAPI } from '@/libs/apis';
import { isDirectS3Upload } from '@/libs/apis/media';
import type { Result } from '@/libs/apis/shared/types';
import { extractMetadataFromImage, summarizeUploadFormats, toMb } from '@/libs/utils/image';

/*
 * 업로드 체인(준비·URL 발급 → S3 전송 → 묶음 등록 → 후속 작업)에서 React 상태와 무관한 부분.
 * 화면 상태와 재시도 계기는 useImageUpload가 맡고, 여기에는 설정값과 UploadContext를 채우고 읽는 함수만 둔다.
 */

/*
 * 동시 전송 수. Uppy의 S3 업로드 기본값과 같다.
 * uploadToS3의 첫 진행 타이머는 요청을 띄운 순간부터 돈다. 브라우저는 HTTP/1.1 호스트당 6개만 실제로 보내므로
 * 그보다 많이 띄우면 대기열 뒤쪽 파일이 보내지도 못한 채 시간 초과로 끊긴다.
 * CapacitorHttp 경로는 요청마다 본문을 base64로 바꿔 메모리에 올리므로 동시 수가 곧 메모리 사용량이기도 하다.
 */
export const MAX_CONCURRENT_S3_UPLOADS = 6;

// 메타데이터 등록 묶음 크기. 전송 중에는 묶음이 다 올라가는 즉시 등록하고, 전송이 끝나면 덜 찬 묶음도 등록한다.
export const REGISTER_BATCH_SIZE = 50;

// 일시적 네트워크 단절(iOS '네트워크 연결이 유실되었습니다' 등)을 흡수하는 파일별 재시도. 첫 시도 + 2회 = 최대 3회
const FILE_RETRY_ATTEMPTS = 2;
// 1초, 2초 지수 backoff. 일시적 단절은 보통 수 초 안에 회복된다.
const FILE_RETRY_BASE_DELAY_MS = 1000;

/*
 * 등록이 응답 없이(네트워크·시간 초과) 또는 5xx로 실패하면 같은 묶음을 다시 보낸다(서버가 항목별로 멱등이다).
 * 시간 초과면 이미 60초를 기다렸으므로 한 번만 더 보내고, 그래도 안 되면 재시도 버튼·온라인 복귀에 맡긴다.
 */
const REGISTER_RETRY_ATTEMPTS = 1;

/**
 * presign이 거부한 이유. 형식·용량은 업로드 전 검증과 같은 안내를 쓰려고 같은 분류로 바꾼다.
 * invalid_request = 요청 형식 오류(1006). 검증이 거르지 못한 값이 섞였다.
 */
export type PresignRejectReason = UploadRejectReason | 'invalid_request';

const PRESIGN_REJECT_CODES: Partial<Record<number, PresignRejectReason>> = {
    5008: 'unsupported_format',
    5005: 'too_large',
    1006: 'invalid_request',
};

export interface UploadStats {
    /** 올릴 파일 수. 서버가 중복이라 알려 온 파일은 뺀다. */
    total: number;
    /** S3 전송이 끝난 파일 수. 재시도를 넘어 파일당 한 번만 센다. */
    succeeded: number;
    /** 가장 최근 실행에서 S3 전송에 실패한 파일 수. 재시도가 시작되면 0으로 돌아간다. */
    failed: number;
}

/** 화면에 보여줄 업로드 단계. registering = 전송은 끝났고 남은 묶음 등록을 기다리는 중 */
export type UploadPhase = 'idle' | 'preparing' | 'uploading' | 'registering' | 'finalizing' | 'done' | 'failed';

/** 업로드 체인이 거부할 때 쓰는 오류. 화면이 단계별 안내를 고를 수 있게 단계와 남은 장수를 싣는다. */
export class UploadChainError extends Error {
    readonly stage: UploadStage;
    /** 이 단계에서 끝내지 못한 파일 수. 준비·URL 발급 실패는 전체 장수, 후속 작업 실패는 0이다. */
    readonly failedCount: number;
    /** presign이 형식·용량으로 거부했을 때. 다시 시도해도 같다. */
    readonly rejectReason?: PresignRejectReason;

    constructor(
        stage: UploadStage,
        failedCount: number,
        message: string,
        options?: { cause?: unknown; rejectReason?: PresignRejectReason },
    ) {
        super(message, options);
        this.name = 'UploadChainError';
        this.stage = stage;
        this.failedCount = failedCount;
        this.rejectReason = options?.rejectReason;
    }
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/*
 * 업로드 추적 이벤트용 집계. React state와 따로 둔다 — 이벤트는 렌더와 무관하게 정확한 값을 보내야 한다.
 * 여기에는 실행(첫 업로드·재시도)을 넘어 누적되는 값만 둔다. 실행별 실패 분류·재시도 횟수는 UploadRun에 센다.
 * 재시도가 이전 체인을 끊고 바로 새 체인을 띄우면 두 체인이 잠시 겹치기 때문이다.
 */
interface UploadTelemetry {
    uploadId: string;
    startedAt: number;
    total: number;
    /** 시작된 체인 실행 수. 첫 업로드 = 1, 재시도마다 +1 */
    attempts: number;
}

/** 업로드 한 건의 진행 상태. 재시도는 끝나지 않은 일만 다시 한다: 준비·URL 발급 → 미전송 파일 → 미등록 묶음 → 후속 작업 */
export interface UploadContext {
    tripKey: string;
    fileArray: File[];
    /** 준비 단계가 끝나기 전에는 null. 재시도가 거기서부터 다시 시작한다. */
    imagesWithMetadata: ClientImageFile[] | null;
    /** 파일 인덱스별 PUT URL. 없으면 (다시) 발급받아야 한다. */
    targets: Map<number, UploadTarget>;
    /** URL 갱신 중인 파일과 그 요청. 동시에 만료를 알아챈 전송들이 한 요청을 같이 기다린다. */
    renewing: Map<number, Promise<void>>;
    /** 서버가 중복이라 알려 와 올리지 않는 파일. 행이 없어 등록도 하지 않는다. */
    duplicateIndices: Set<number>;
    /** '그래도 올리기'를 고른 파일. 중복 검사 없이 발급받는다. */
    allowDuplicateIndices: Set<number>;
    /** 진행 중인 준비. 겹친 체인이 URL을 따로 발급받으면 같은 파일에 행이 두 개 생긴다. */
    preparing: Promise<void> | null;
    /** 전송·등록이 모두 끝난 뒤 같은 체인에서 할 일(예: 여행 상태 전환) */
    postUploadTask?: () => Promise<unknown>;
    postUploadTaskCompleted: boolean;
    /*
     * 전송이 끝난 파일과 그 PUT에 쓴 mediaFileId. 겹친 체인이 같은 파일을 두 번 올려도 한 번만 센다.
     * 등록은 이 id로 한다. 그사이 URL을 새로 발급받아 targets의 id가 바뀌어도 실제로 올린 행을 등록하게 한다.
     */
    transferred: Map<number, number>;
    transferredBytes: number;
    /** 가장 최근 실행에서 전송에 실패한 파일(화면 표시용). 다시 보낼 파일은 transferred로 고른다. */
    failedIndices: Set<number>;
    registeredIndices: Set<number>;
    /** 등록 응답이 행이 없다고 한 파일(고아 정리). 전송 실패가 아니라 등록 실패로 센다. 새로 발급받으면 빠진다. */
    orphanedIndices: Set<number>;
    /** 등록 요청이 진행 중인 묶음. 서버는 같은 묶음을 두 번 받아도 한 번만 처리하지만, 요청과 세션 반영이 겹치지 않게 같이 기다린다. */
    registeringBatches: Map<number, { request: Promise<void>; indices: Set<number> }>;
    /*
     * offline 이벤트로 일괄 abort하고, 재시도 때 새 controller로 바꾼다.
     * 끊긴 연결(좀비 socket)이 기기의 연결 풀을 차지하기 전에 명시적으로 끊는 것이 핵심이다.
     */
    abortController: AbortController;
    telemetry: UploadTelemetry;
}

export const createUploadContext = (
    tripKey: string,
    fileArray: File[],
    options: { postUploadTask?: () => Promise<unknown>; precomputedMetadata?: ClientImageFile[] } = {},
): UploadContext => ({
    tripKey,
    fileArray,
    imagesWithMetadata: options.precomputedMetadata ?? null,
    targets: new Map(),
    renewing: new Map(),
    duplicateIndices: new Set(),
    allowDuplicateIndices: new Set(),
    preparing: null,
    postUploadTask: options.postUploadTask,
    postUploadTaskCompleted: false,
    transferred: new Map(),
    transferredBytes: 0,
    failedIndices: new Set(),
    registeredIndices: new Set(),
    orphanedIndices: new Set(),
    registeringBatches: new Map(),
    abortController: new AbortController(),
    telemetry: {
        uploadId: createUploadId(),
        startedAt: Date.now(),
        total: fileArray.length,
        attempts: 0,
    },
});

/** 등록해야 하는데 아직 안 된 파일 수. 중복이라 빠진 파일은 등록할 행이 없다. */
export const unregisteredCount = (ctx: UploadContext) =>
    ctx.fileArray.length - ctx.registeredIndices.size - ctx.duplicateIndices.size;

/** 재시도로 할 일이 남았는지. 끝난 업로드를 다시 돌려 가짜 종료 이벤트를 만들지 않으려고 두 재시도 경로가 같이 쓴다. */
export const hasPendingWork = (ctx: UploadContext) =>
    // 준비·URL 발급·전송 실패도 모두 미등록으로 남으므로 등록 수 하나로 판단된다.
    unregisteredCount(ctx) > 0 || (Boolean(ctx.postUploadTask) && !ctx.postUploadTaskCompleted);

/** '그래도 올리기'. 중복으로 빠진 파일을 중복 검사 없이 다시 발급받을 대상으로 돌린다. 다음 실행이 올린다. */
export const acceptDuplicates = (ctx: UploadContext) => {
    ctx.duplicateIndices.forEach((index) => ctx.allowDuplicateIndices.add(index));
    ctx.duplicateIndices.clear();
};

/** 한 번의 체인 실행 결과 */
export interface UploadRun {
    attempt: number;
    trigger: UploadTrigger;
    failures: FailureCounts;
    fileRetries: number;
    /** 이 실행에서 새로 서명받은 URL 수(만료 임박·PUT 거부) */
    renewals: number;
    /** 이 실행의 등록 응답에서 행이 없다고 온 파일 수 */
    registerNotFound: number;
    /** 재시도가 이 실행을 끊고 새 실행을 띄웠으면 true. 대시보드에서 최종 결과만 볼 때 거른다. */
    superseded: boolean;
}

export const startRun = (ctx: UploadContext, trigger: UploadTrigger): UploadRun => {
    ctx.telemetry.attempts += 1;
    return {
        attempt: ctx.telemetry.attempts,
        trigger,
        failures: emptyFailureCounts(),
        fileRetries: 0,
        renewals: 0,
        registerNotFound: 0,
        superseded: false,
    };
};

/** 장수·형식·용량만 보낸다(summarizeUploadFormats). 파일명·tripKey는 싣지 않는다. */
export const trackUploadStarted = (ctx: UploadContext, source: UploadSource) =>
    track(ANALYTICS_EVENTS.UPLOAD_STARTED, {
        upload_id: ctx.telemetry.uploadId,
        source,
        concurrency: MAX_CONCURRENT_S3_UPLOADS,
        direct_upload: isDirectS3Upload(),
        ...summarizeUploadFormats(ctx.fileArray),
    });

/** 짝이 되는 upload_started가 없는 upload_finished를 만들지 않도록, 시작한 업로드에 대해서만 부른다. */
export const trackUploadFinished = (
    { telemetry, transferred, transferredBytes, duplicateIndices }: UploadContext,
    run: UploadRun,
    props: { source: UploadSource; failedStage: UploadStage | null },
) =>
    track(ANALYTICS_EVENTS.UPLOAD_FINISHED, {
        upload_id: telemetry.uploadId,
        source: props.source,
        trigger: run.trigger,
        attempt: run.attempt,
        superseded: run.superseded,
        outcome: props.failedStage ? 'failed' : 'success',
        failed_stage: props.failedStage,
        total: telemetry.total,
        succeeded: transferred.size,
        failed: Object.values(run.failures).reduce((sum, n) => sum + n, 0),
        succeeded_mb: toMb(transferredBytes),
        file_retries: run.fileRetries,
        renewed_count: run.renewals,
        duplicate_count: duplicateIndices.size,
        register_not_found: run.registerNotFound,
        elapsed_ms: Date.now() - telemetry.startedAt,
        concurrency: MAX_CONCURRENT_S3_UPLOADS,
        ...flattenFailureCounts(run.failures),
    });

/** 아직 보내야 하는데 URL이 없는 파일 */
const missingTargets = (ctx: UploadContext) => pendingTransfers(ctx).filter((index) => !ctx.targets.has(index));

/** 준비(EXIF·URL 발급)가 남았는지 */
export const needsPrepare = (ctx: UploadContext) => !ctx.imagesWithMetadata || missingTargets(ctx).length > 0;

/**
 * EXIF를 읽고, URL이 없는 파일만 발급받는다. 읽은 EXIF와 받은 URL은 ctx에 남아 재시도가 다시 하지 않는다.
 * 실패하면 UploadChainError(prepare | presign)를 던진다.
 */
export const prepareUploadContext = async (
    ctx: UploadContext,
    onMetadataProgress: Dispatch<SetStateAction<{ metadata: number }>>,
): Promise<void> => {
    // 겹친 체인이 따로 발급받으면 같은 파일에 행이 두 개 생긴다. 진행 중인 준비가 끝난 뒤 남은 것만 한다.
    // 그 준비가 실패했으면 이 체인이 다시 해 본다. 실패는 그 준비를 띄운 체인이 받는다.
    while (ctx.preparing) await ctx.preparing.catch(() => {});
    if (!needsPrepare(ctx)) return;
    ctx.preparing = runPrepare(ctx, onMetadataProgress).finally(() => {
        ctx.preparing = null;
    });
    await ctx.preparing;
};

const runPrepare = async (
    ctx: UploadContext,
    onMetadataProgress: Dispatch<SetStateAction<{ metadata: number }>>,
): Promise<void> => {
    const total = ctx.fileArray.length;
    try {
        // 서버의 중복 검사가 촬영 시각을 쓰므로 EXIF를 먼저 읽는다.
        ctx.imagesWithMetadata ??= await extractMetadataFromImage(ctx.fileArray, onMetadataProgress);
    } catch (error) {
        throw new UploadChainError('prepare', total, errorMessage(error), { cause: error });
    }
    const indices = missingTargets(ctx);
    let failure: PresignFailure | null;
    try {
        failure = await presignFiles(ctx, indices);
    } catch (error) {
        throw new UploadChainError('prepare', total, errorMessage(error), { cause: error });
    }
    if (failure) {
        throw new UploadChainError('presign', indices.length, failure.error, {
            rejectReason: failure.code === undefined ? undefined : PRESIGN_REJECT_CODES[failure.code],
        });
    }
};

/** 파일 하나를 올린다. 네트워크·5xx·시간 초과만 다시 보내고, 재시도할 때마다 onRetry를 부른다. */
const uploadWithRetry = async (
    target: UploadTarget,
    file: File,
    signal: AbortSignal,
    onRetry: () => void,
): Promise<void> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= FILE_RETRY_ATTEMPTS; attempt++) {
        // 풀에서 대기하다 시작 전에, 또는 backoff 중에 취소된 파일. 외부 취소로 분류되게 같은 오류를 쓴다.
        if (signal.aborted) throw new UploadAbortError('external');
        try {
            await mediaAPI.uploadToS3(target.putUrl, file, target.contentType, signal);
            return;
        } catch (e) {
            lastErr = e;
            // 오프라인이면 backoff를 기다리지 않고 바로 끝낸다. 끊긴 연결을 더 만들지 않는다.
            if (signal.aborted) throw e;
            // 4xx는 같은 URL로 다시 보내도 같다. transferFile이 URL을 갱신해 한 번 더 보낸다.
            if (classifyUploadError(e) === 'http_4xx') throw e;
            if (attempt < FILE_RETRY_ATTEMPTS) {
                onRetry();
                await new Promise((r) => setTimeout(r, FILE_RETRY_BASE_DELAY_MS * 2 ** attempt));
            }
        }
    }
    throw lastErr;
};

/**
 * 파일 하나를 보내고 전송 완료로 표시한다. 만료가 임박한 URL은 보내기 전에 갱신하고,
 * 4xx로 거부되면(만료·서명 불일치) 이 실행에서 한 번만 URL을 갱신해 다시 보낸다. 이미 등록된 파일이면 보내지 않는다.
 */
export const transferFile = async (
    ctx: UploadContext,
    run: UploadRun,
    index: number,
    signal: AbortSignal,
): Promise<void> => {
    const file = ctx.fileArray[index];
    let renewedAfterRejection = false;
    for (;;) {
        const target = await ensureFreshTarget(ctx, run, index);
        // 겹친 체인이 먼저 올렸거나 이미 등록됐다. 다시 보내다 실패해도 실패로 세지 않게 여기서 끝낸다.
        if (ctx.transferred.has(index) || ctx.registeredIndices.has(index)) return;
        // 고아 정리 뒤 다시 발급받지 못한 파일
        if (!target) throw new Error('업로드 URL 없음');
        try {
            await uploadWithRetry(target, file, signal, () => {
                run.fileRetries += 1;
            });
            if (!ctx.transferred.has(index)) {
                ctx.transferred.set(index, target.mediaFileId);
                ctx.transferredBytes += file.size;
            }
            return;
        } catch (error) {
            if (renewedAfterRejection || signal.aborted || classifyUploadError(error) !== 'http_4xx') throw error;
            renewedAfterRejection = true;
            await renewTargets(ctx, run, [index]);
            const renewed = ctx.targets.get(index);
            // 새 URL을 받지 못했으면 다시 보내도 같다
            if (!ctx.registeredIndices.has(index) && (!renewed || renewed === target)) throw error;
        }
    }
};

const range = (start: number, end: number) => Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);

export const batchOf = (index: number) => Math.floor(index / REGISTER_BATCH_SIZE);

const batchIndices = (ctx: UploadContext, batch: number) =>
    range(batch * REGISTER_BATCH_SIZE, Math.min(ctx.fileArray.length, (batch + 1) * REGISTER_BATCH_SIZE));

/** 모든 묶음 번호 */
export const allBatches = (ctx: UploadContext) => range(0, Math.ceil(ctx.fileArray.length / REGISTER_BATCH_SIZE));

/** 아직 보내야 하는 파일 인덱스 */
export const pendingTransfers = (ctx: UploadContext) =>
    range(0, ctx.fileArray.length).filter((index) => isPendingTransfer(ctx, index));

const needsRegistration = (ctx: UploadContext, index: number) =>
    ctx.transferred.has(index) && !ctx.registeredIndices.has(index);

/** 묶음에 전송은 끝났고 아직 등록 안 된 파일이 있는지. 전송이 다 끝난 뒤에는 덜 찬 묶음도 이것으로 등록한다. */
export const hasUnregisteredTransfers = (ctx: UploadContext, batch: number) =>
    batchIndices(ctx, batch).some((index) => needsRegistration(ctx, index));

/** 전송 중 바로 등록할 묶음인지: 묶음의 파일이 모두 보내졌거나 빠졌고(중복·등록됨), 등록할 파일이 남았다. */
export const isBatchReadyToRegister = (ctx: UploadContext, batch: number) =>
    batchIndices(ctx, batch).every((index) => !isPendingTransfer(ctx, index)) && hasUnregisteredTransfers(ctx, batch);

// 응답이 없었거나(네트워크·시간 초과) 서버 오류면 같은 묶음을 다시 보내도 된다
const isTransientFailure = (result: Result<unknown>) =>
    !result.success && (result.status === undefined || result.status >= 500);

const sendRegistration = async (
    ctx: UploadContext,
    items: Parameters<typeof mediaAPI.triggerMediaProcessing>[1],
    signal: AbortSignal,
) => {
    let result = await mediaAPI.triggerMediaProcessing(ctx.tripKey, items);
    for (let attempt = 0; attempt < REGISTER_RETRY_ATTEMPTS && isTransientFailure(result); attempt++) {
        if (signal.aborted) break;
        await new Promise((r) => setTimeout(r, FILE_RETRY_BASE_DELAY_MS));
        result = await mediaAPI.triggerMediaProcessing(ctx.tripKey, items);
    }
    return result;
};

/** 응답 항목을 파일에 반영하고, 세션 스토어에 넣을 항목을 돌려준다. sent는 [파일 인덱스, 보낸 mediaFileId] */
const applyRegistration = (
    ctx: UploadContext,
    run: UploadRun,
    sent: [number, number][],
    items: MediaRequestItem[],
): MediaFileItem[] => {
    const byId = new Map(items.map((item) => [item.mediaFileId, item]));
    const registered: MediaFileItem[] = [];
    for (const [index, mediaFileId] of sent) {
        const item = byId.get(mediaFileId);
        if (!item) continue;
        // 고아 정리로 행이 지워졌다. 다음 실행이 새로 발급받아 다시 올리고 등록한다.
        if (item.status === 'NOT_FOUND') {
            if (ctx.targets.get(index)?.mediaFileId === mediaFileId) ctx.targets.delete(index);
            if (ctx.transferred.get(index) === mediaFileId) {
                ctx.transferred.delete(index);
                ctx.transferredBytes -= ctx.fileArray[index].size;
            }
            ctx.orphanedIndices.add(index);
            run.registerNotFound += 1;
            continue;
        }
        // 그 밖의 상태는 모두 등록된 것이다. FAILED는 처리 실패라 세션 스토어로 보여 주고 재처리로 다룬다.
        ctx.registeredIndices.add(index);
        registered.push(item);
    }
    return registered;
};

/**
 * 한 묶음에서 전송이 끝나고 아직 등록 안 된 파일을 등록한다(던지지 않는다).
 * 서버에 커밋된 결과는 끊긴 체인이 받았더라도 ctx에 남겨 다시 등록하지 않게 한다.
 */
export const registerBatch = (ctx: UploadContext, run: UploadRun, batch: number): Promise<void> => {
    const inFlight = ctx.registeringBatches.get(batch);
    if (inFlight) {
        // 그 요청을 만든 뒤 같은 묶음에서 더 올라간 파일이 있으면, 끝난 뒤 그 파일만 이어서 등록한다
        return inFlight.request.then(() => {
            const missed = batchIndices(ctx, batch).some(
                (index) => needsRegistration(ctx, index) && !inFlight.indices.has(index),
            );
            return missed ? registerBatch(ctx, run, batch) : undefined;
        });
    }
    const sent = batchIndices(ctx, batch)
        .filter((index) => needsRegistration(ctx, index))
        .map((index): [number, number] => [index, ctx.transferred.get(index)!]);
    const images = ctx.imagesWithMetadata!;
    const items = sent.map(([index, mediaFileId]) => {
        const { recordDate, latitude, longitude } = images[index];
        return {
            mediaFileId,
            latitude: latitude || DEFAULT_METADATA.LOCATION,
            longitude: longitude || DEFAULT_METADATA.LOCATION,
            recordDate: recordDate || DEFAULT_METADATA.DATE,
        };
    });
    const registration = sendRegistration(ctx, items, ctx.abortController.signal)
        .then((result) => {
            if (!result.success) return;
            const registered = applyRegistration(ctx, run, sent, result.data);
            // 같은 여행의 세션이면 더한다. 동기화로 받은 이전 업로드의 실패 사진을 지우지 않는다.
            if (registered.length > 0) useUploadSessionStore.getState().appendItems(ctx.tripKey, registered);
        })
        .catch(() => {})
        .finally(() => ctx.registeringBatches.delete(batch));
    ctx.registeringBatches.set(batch, { request: registration, indices: new Set(sent.map(([index]) => index)) });
    return registration;
};
