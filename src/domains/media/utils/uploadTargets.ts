import { DEFAULT_METADATA } from '@/domains/media/constants';
import type { PresignedUrlResponse, PresignFileInfo } from '@/domains/media/types';
import type { UploadContext, UploadRun } from '@/domains/media/utils/uploadChain';
import { isGenericType } from '@/domains/media/utils/uploadValidation';
import { mediaAPI } from '@/libs/apis';
import type { Result } from '@/libs/apis/shared/types';
import { chunk } from '@/libs/utils/array';

/*
 * 파일별 PUT URL(업로드 대상)의 발급과 갱신. 업로드 체인이 보내기 직전에 부른다.
 * URL은 10분 뒤 만료된다. 만료가 다가오거나 PUT이 거부되면 새 행 없이 같은 키로 다시 서명받는다.
 */

/*
 * 이 시간 안에 만료되는 URL은 보내기 전에 갱신한다.
 * 서버는 PUT 시작 시점에 만료를 보지만, 브라우저 대기열·재시도 backoff로 실제 시작이 늦어질 수 있다.
 */
export const URL_RENEW_MARGIN_MS = 60_000;

// presign·renew 요청 하나의 최대 파일 수. 서버 상한이라 화면의 장수 제한(MAX_UPLOAD_FILES)이 바뀌어도 지켜야 한다.
const PRESIGN_BATCH_LIMIT = 500;

export interface UploadTarget {
    mediaFileId: number;
    putUrl: string;
    /** 서명에 묶인 Content-Type. 서버가 주지 않으면 파일의 type */
    contentType: string;
    /** 만료 시각(ms). 서버가 주지 않으면 null이고 미리 갱신하지 않는다. */
    expiresAt: number | null;
    /** 받은 시각(ms) */
    receivedAt: number;
}

export type PresignFailure = Extract<Result<never>, { success: false }>;

/** 날짜 없는 사진은 기본값(1980년)끼리 중복으로 잡히므로 촬영 시각을 보내지 않는다. */
const toPresignFileInfo = (ctx: UploadContext, index: number): PresignFileInfo => {
    const file = ctx.fileArray[index];
    const recordDate = ctx.imagesWithMetadata?.[index]?.recordDate;
    return {
        fileName: file.name,
        // 서버가 이 크기로 Content-Length를 서명한다. PUT 본문도 같은 File이다.
        size: file.size,
        // 비었거나 octet-stream이면 보내지 않는다. 서버가 확장자로 정한다.
        ...(isGenericType(file.type) ? {} : { contentType: file.type }),
        ...(recordDate && recordDate !== DEFAULT_METADATA.DATE ? { recordDate } : {}),
    };
};

const toTarget = (response: PresignedUrlResponse, file: File): UploadTarget | null => {
    if (typeof response.mediaFileId !== 'number' || !response.presignedPutUrl) return null;
    const expiresAt = response.expiresAt ? Date.parse(response.expiresAt) : NaN;
    return {
        mediaFileId: response.mediaFileId,
        putUrl: response.presignedPutUrl,
        contentType: response.contentType || file.type,
        expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
        receivedAt: Date.now(),
    };
};

/** 아직 보내야 하는 파일. 전송이 끝났거나, 이미 등록됐거나, 중복이라 빠진 파일이 아니다. */
export const isPendingTransfer = (ctx: UploadContext, index: number) =>
    !ctx.transferred.has(index) && !ctx.registeredIndices.has(index) && !ctx.duplicateIndices.has(index);

/*
 * 기기 시계가 서버보다 많이 빠르면 방금 받은 URL도 만료 직전으로 보인다.
 * 받은 지 URL_RENEW_MARGIN_MS가 안 된 URL은 갱신하지 않아, 그런 기기에서도 갱신 요청이 쏟아지지 않게 한다.
 */
const isNearExpiry = (target: UploadTarget, now: number) =>
    target.expiresAt !== null &&
    target.expiresAt - now < URL_RENEW_MARGIN_MS &&
    now - target.receivedAt >= URL_RENEW_MARGIN_MS;

/**
 * indices의 URL을 새로 발급받아 ctx에 넣는다. 서버가 중복이라 하면 duplicateIndices로 옮긴다.
 * '그래도 올리기'를 고른 파일(allowDuplicateIndices)은 중복 검사 없이 따로 발급받는다. 실패하면 그 결과를 돌려준다.
 */
export const presignFiles = async (ctx: UploadContext, indices: number[]): Promise<PresignFailure | null> => {
    const groups: [number[], boolean][] = [
        [indices.filter((index) => !ctx.allowDuplicateIndices.has(index)), false],
        [indices.filter((index) => ctx.allowDuplicateIndices.has(index)), true],
    ];
    for (const [group, allowDuplicates] of groups) {
        for (const part of chunk(group, PRESIGN_BATCH_LIMIT)) {
            const result = await mediaAPI.requestPresignedUrls(
                ctx.tripKey,
                part.map((index) => toPresignFileInfo(ctx, index)),
                { allowDuplicates },
            );
            if (!result.success) return result;
            // 응답은 요청과 같은 순서다
            result.data.forEach((response, k) => {
                const index = part[k];
                ctx.orphanedIndices.delete(index);
                if (response.duplicate) {
                    ctx.duplicateIndices.add(index);
                    ctx.targets.delete(index);
                    return;
                }
                const target = toTarget(response, ctx.fileArray[index]);
                if (target) ctx.targets.set(index, target);
            });
        }
    }
    return null;
};

const requestRenewal = async (ctx: UploadContext, run: UploadRun, indices: number[]): Promise<void> => {
    const indexById = new Map(indices.map((index) => [ctx.targets.get(index)!.mediaFileId, index]));
    const orphaned: number[] = [];
    for (const ids of chunk([...indexById.keys()], PRESIGN_BATCH_LIMIT)) {
        const result = await mediaAPI.renewPresignedUrls(ctx.tripKey, ids);
        // 갱신하지 못하면 기존 URL을 그대로 둔다. 만료 직전이라도 아직 유효할 수 있다.
        if (!result.success) continue;
        for (const response of result.data.presignedUrls) {
            const index = typeof response.mediaFileId === 'number' ? indexById.get(response.mediaFileId) : undefined;
            const target = index === undefined ? null : toTarget(response, ctx.fileArray[index]);
            if (index === undefined || !target) continue;
            ctx.targets.set(index, target);
            run.renewals += 1;
        }
        for (const { mediaFileId, reason } of result.data.skipped) {
            const index = indexById.get(mediaFileId);
            if (index === undefined) continue;
            switch (reason) {
                // 다른 실행이 이미 등록했다. 다시 보내지 않는다.
                case 'ALREADY_REGISTERED':
                    ctx.registeredIndices.add(index);
                    break;
                // 오래 멈춘 사이 고아 정리(6시간)가 행을 지웠다. 아래에서 새로 발급받는다.
                case 'NOT_FOUND':
                    ctx.targets.delete(index);
                    orphaned.push(index);
                    break;
            }
        }
    }
    if (orphaned.length > 0) await presignFiles(ctx, orphaned);
};

/**
 * indices와, 만료가 임박한 다른 미전송 파일의 URL을 한 요청으로 갱신한다(같은 때 받은 URL은 같이 만료된다).
 * 이미 갱신 중인 파일은 새 요청을 만들지 않고 그 요청을 같이 기다린다. 던지지 않는다.
 */
export const renewTargets = async (ctx: UploadContext, run: UploadRun, indices: number[]): Promise<void> => {
    const waiting = new Set<Promise<void>>();
    const toRenew = new Set<number>();
    for (const index of indices) {
        const inFlight = ctx.renewing.get(index);
        if (inFlight) waiting.add(inFlight);
        else if (ctx.targets.has(index)) toRenew.add(index);
    }
    if (toRenew.size > 0) {
        const now = Date.now();
        ctx.targets.forEach((target, index) => {
            if (!ctx.renewing.has(index) && isPendingTransfer(ctx, index) && isNearExpiry(target, now)) {
                toRenew.add(index);
            }
        });
        const renewing = [...toRenew];
        const request = requestRenewal(ctx, run, renewing).finally(() =>
            renewing.forEach((index) => ctx.renewing.delete(index)),
        );
        renewing.forEach((index) => ctx.renewing.set(index, request));
        waiting.add(request);
    }
    await Promise.all(waiting);
};

/** 보내기 직전의 URL. 만료가 임박했거나 갱신 중이면 갱신을 기다린다. 발급받지 못한 파일이면 undefined */
export const ensureFreshTarget = async (
    ctx: UploadContext,
    run: UploadRun,
    index: number,
): Promise<UploadTarget | undefined> => {
    const target = ctx.targets.get(index);
    if (ctx.renewing.has(index) || (target && isNearExpiry(target, Date.now()))) {
        await renewTargets(ctx, run, [index]);
    }
    return ctx.targets.get(index);
};
