import { useCallback, useEffect, useRef, useState } from 'react';

import { useParams } from 'react-router-dom';

import { ClientImageFile, MediaFileCategories } from '@/domains/media/types';
import { filterWithoutDateMediaFile, filterWithoutLocationMediaFile } from '@/domains/media/utils';
import {
    acceptDuplicates,
    allBatches,
    batchOf,
    createUploadContext,
    errorMessage,
    hasPendingWork,
    hasUnregisteredTransfers,
    isBatchReadyToRegister,
    MAX_CONCURRENT_S3_UPLOADS,
    needsPrepare,
    pendingTransfers,
    prepareUploadContext,
    registerBatch,
    startRun,
    trackUploadFinished,
    trackUploadStarted,
    transferFile,
    unregisteredCount,
    UploadChainError,
    type UploadContext,
    type UploadPhase,
    type UploadStats,
} from '@/domains/media/utils/uploadChain';
import {
    classifyUploadError,
    type UploadSource,
    type UploadStage,
    type UploadTrigger,
} from '@/domains/media/utils/uploadTelemetry';
import {
    describeExcluded,
    validateUploadFiles,
    withSupportedExtension,
    type PickerReport,
} from '@/domains/media/utils/uploadValidation';
import { ANALYTICS_EVENTS, track } from '@/libs/analytics';
import { runWithPool } from '@/libs/utils/async';
import { extractMetadataFromImage, removeDuplicateImages } from '@/libs/utils/image';
import { useToastStore } from '@/shared/stores/useToastStore';

const categorize = (images: ClientImageFile[]): MediaFileCategories => ({
    withAll: { count: images.length },
    withoutLocation: { count: filterWithoutLocationMediaFile(images).length },
    withoutDate: { count: filterWithoutDateMediaFile(images).length },
});

interface UseImageUploadOptions {
    /** 업로드 추적 이벤트에 싣는 화면 구분 */
    source: UploadSource;
    /** 재시도(수동·온라인 복귀)한 실행이 끝까지 성공했을 때. 첫 실행 성공에는 부르지 않는다. */
    onRecovered?: () => void;
}

export const useImageUpload = ({ source, onRecovered }: UseImageUploadOptions) => {
    const [images, setImages] = useState<ClientImageFile[]>();
    const [imageCategories, setImageCategories] = useState<MediaFileCategories>();
    const [progress, setProgress] = useState({ metadata: 0 });
    const [uploadStats, setUploadStats] = useState<UploadStats>({ total: 0, succeeded: 0, failed: 0 });
    const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
    // 서버가 이미 있다고 알려 와 올리지 않은 장수. '그래도 올리기'로 올릴 수 있다.
    const [duplicateCount, setDuplicateCount] = useState(0);
    const bgUploadPromiseRef = useRef<Promise<void> | null>(null);
    const uploadContextRef = useRef<UploadContext | null>(null);
    // 두 번째 업로드가 첫 체인의 promise를 ref에서 덮어써 아무도 기다리지 않게 되는 것을 막는다. 호출부 가드와 별개로 둔다.
    const uploadInProgressRef = useRef(false);
    // '그래도 올리기'를 눌러 진행 중인 체인이 끝나기를 기다리는 업로드. 그새 안내가 다시 뜨거나 두 번 돌지 않게 한다.
    const duplicateUploadQueuedRef = useRef<UploadContext | null>(null);
    // 호출부가 매 렌더 새 함수를 넘겨도 체인·effect가 다시 돌지 않게 ref로 받는다.
    const onRecoveredRef = useRef(onRecovered);
    useEffect(() => {
        onRecoveredRef.current = onRecovered;
    }, [onRecovered]);

    const { tripKey } = useParams();

    /** 중복을 빼고 형식·용량·장수를 검사한다. 제외된 사진이 있으면 피커의 안내와 합쳐 토스트 하나로 알린다. */
    const prepareUploadFiles = useCallback(async (files: FileList | File[], picker?: PickerReport): Promise<File[]> => {
        // HEIC는 원본 그대로 올린다. 이미지 워커(pillow-heif)가 WebP로 바꾼다. 브라우저에서 바꾸면 EXIF(GPS)가 지워진다.
        const { accepted, rejected } = validateUploadFiles(
            removeDuplicateImages(Array.from(files)).map(withSupportedExtension),
        );
        const message = [picker?.notice, describeExcluded(rejected, picker?.skippedNonImage)].filter(Boolean).join(' ');
        if (message) useToastStore.getState().showToast(message);
        return accepted;
    }, []);

    /*
     * 끝나지 않은 일만 이어서 한다: 준비·URL 발급 → 미전송 파일 전송(묶음이 다 올라가면 바로 등록) → postUploadTask.
     * 첫 업로드와 재시도가 같이 쓰고, ctx의 집합·플래그로 같은 일을 두 번 하지 않는다.
     * 모든 단계가 ctx.abortController의 signal을 공유해 offline 이벤트 한 번으로 모두 끊긴다.
     */
    const buildUploadChain = useCallback(
        (ctx: UploadContext, trigger: UploadTrigger, onPrepared?: () => void): Promise<void> =>
            (async () => {
                const { signal } = ctx.abortController;
                const total = ctx.fileArray.length;
                const run = startRun(ctx, trigger);
                // 재시도가 새 체인을 띄웠거나 새 업로드가 시작되면, 이 체인은 화면 상태·등록·후속 작업을 더 건드리지 않는다.
                const isCurrent = () => ctx.abortController.signal === signal && uploadContextRef.current === ctx;
                const setPhase = (phase: UploadPhase) => {
                    if (isCurrent()) setUploadPhase(phase);
                };
                const syncStats = () => {
                    if (uploadContextRef.current !== ctx) return;
                    setUploadStats({
                        total: total - ctx.duplicateIndices.size,
                        succeeded: ctx.transferred.size,
                        failed: ctx.failedIndices.size,
                    });
                    setDuplicateCount(duplicateUploadQueuedRef.current === ctx ? 0 : ctx.duplicateIndices.size);
                };
                const reportFinished = (failedStage: UploadStage | null) => {
                    run.superseded = ctx.abortController.signal !== signal;
                    trackUploadFinished(ctx, run, { source, failedStage });
                };

                let stage: UploadStage = 'prepare';
                try {
                    if (needsPrepare(ctx)) {
                        setPhase('preparing');
                        await prepareUploadContext(ctx, setProgress);
                        if (uploadContextRef.current === ctx) {
                            setImages(ctx.imagesWithMetadata!);
                            setImageCategories(categorize(ctx.imagesWithMetadata!));
                        }
                    }
                    onPrepared?.();

                    stage = 's3';
                    const scheduled = new Set<number>();
                    const registrations: Promise<void>[] = [];
                    /*
                     * 전송 중에는 묶음이 다 올라가는 즉시 등록해, 한 묶음의 실패가 다른 묶음을 막지 않게 한다.
                     * allowPartial이면 덜 찬 묶음도 올라간 사진만 등록한다(전송이 다 끝난 뒤).
                     */
                    const maybeRegister = (batch: number, allowPartial = false) => {
                        if (scheduled.has(batch) || !isCurrent()) return;
                        const ready = allowPartial
                            ? hasUnregisteredTransfers(ctx, batch)
                            : isBatchReadyToRegister(ctx, batch);
                        if (!ready) return;
                        scheduled.add(batch);
                        registrations.push(registerBatch(ctx, run, batch));
                    };
                    // 이전 실행에서 전송은 끝났지만 등록이 실패한 묶음
                    allBatches(ctx).forEach((batch) => maybeRegister(batch));

                    const toUpload = pendingTransfers(ctx);
                    if (isCurrent()) ctx.failedIndices.clear();
                    syncStats();
                    if (toUpload.length > 0) {
                        setPhase('uploading');
                        await runWithPool(toUpload, MAX_CONCURRENT_S3_UPLOADS, async (index: number) => {
                            try {
                                await transferFile(ctx, run, index, signal);
                                ctx.failedIndices.delete(index);
                                syncStats();
                                maybeRegister(batchOf(index));
                            } catch (error) {
                                // 던지지 않는다. 풀이 끝까지 돌며 실패를 모두 모은 뒤 한 번에 판단한다.
                                run.failures[classifyUploadError(error)] += 1;
                                if (isCurrent()) ctx.failedIndices.add(index);
                                syncStats();
                            }
                        });
                    }
                    /*
                     * 전송이 다 끝났다. 실패한 파일이 낀 묶음도 올라간 사진은 지금 등록한다. 미루면 그 사진들이
                     * 미등록으로 남아 화면을 떠난 뒤 고아로 지워진다. 겹친 이전 체인이 끝낸 묶음도 여기서 잡힌다.
                     */
                    allBatches(ctx).forEach((batch) => maybeRegister(batch, true));

                    if (registrations.length > 0) setPhase('registering');
                    await Promise.all(registrations);

                    // 새 체인이 남은 일을 이어받았다. 등록·후속 작업이 두 번 돌지 않게 여기서 멈춘다.
                    if (!isCurrent()) {
                        throw new UploadChainError(stage, unregisteredCount(ctx), '재시도로 대체된 실행');
                    }
                    // 등록 응답이 행이 없다고 한 파일은 다시 올려야 하지만 전송 실패는 아니다. 아래 등록 실패로 센다.
                    const notUploaded = pendingTransfers(ctx).filter((index) => !ctx.orphanedIndices.has(index)).length;
                    if (notUploaded > 0) {
                        throw new UploadChainError('s3', notUploaded, `${notUploaded}장 업로드 실패`);
                    }
                    stage = 'register';
                    const unregistered = unregisteredCount(ctx);
                    if (unregistered > 0) {
                        throw new UploadChainError('register', unregistered, `${unregistered}장 등록 실패`);
                    }

                    stage = 'post_task';
                    if (ctx.postUploadTask && !ctx.postUploadTaskCompleted) {
                        setPhase('finalizing');
                        await ctx.postUploadTask();
                        ctx.postUploadTaskCompleted = true;
                    }
                } catch (error) {
                    const chainError =
                        error instanceof UploadChainError
                            ? error
                            : new UploadChainError(stage, 0, errorMessage(error), { cause: error });
                    reportFinished(chainError.stage);
                    setPhase('failed');
                    throw chainError;
                }
                reportFinished(null);
                setPhase('done');
                if (trigger !== 'initial' && isCurrent()) onRecoveredRef.current?.();
            })(),
        [source],
    );

    // 체인을 띄우고 waitForBackgroundUpload가 기다릴 promise로 건다. 첫 업로드와 재시도가 같이 쓴다.
    const startChain = useCallback(
        (ctx: UploadContext, trigger: UploadTrigger, onPrepared?: () => void): Promise<void> => {
            uploadInProgressRef.current = true;
            const chain = buildUploadChain(ctx, trigger, onPrepared);
            bgUploadPromiseRef.current = chain;
            // 실패는 waitForBackgroundUpload를 부른 쪽이 받는다. 여기서 이어 붙인 promise는 처리되지 않은 거부로 남지 않게 받아 둔다.
            chain.catch(() => {});
            chain
                .finally(() => {
                    // 끊긴 이전 체인이 늦게 끝나며 진행 중인 새 체인의 플래그를 풀지 않게, 지금 체인일 때만 푼다.
                    if (bgUploadPromiseRef.current === chain) uploadInProgressRef.current = false;
                })
                .catch(() => {});
            return chain;
        },
        [buildUploadChain],
    );

    /*
     * 업로드를 시작하고, 준비·URL 발급이 끝나면 돌아온다. 전송·등록은 백그라운드로 이어지고 waitForBackgroundUpload로 기다린다.
     * started=false면 준비 단계에서 실패한 것이고, retryFailedUploads로 거기서부터 다시 시작할 수 있다.
     * postUploadTask는 전송·등록 뒤 같은 체인에서 실행해, 실패하면 업로드 실패와 같은 재시도 흐름을 탄다.
     */
    const uploadImagesToS3 = useCallback(
        async (
            uniqueFiles: readonly File[],
            postUploadTask?: () => Promise<unknown>,
            /** 이미 읽은 EXIF(두 번 읽지 않게). uniqueFiles와 순서가 같아야 한다. */
            precomputedMetadata?: ClientImageFile[],
        ): Promise<{ started: boolean }> => {
            if (uploadInProgressRef.current) {
                throw new Error('이미 진행 중인 업로드가 있습니다. 완료 후 다시 시도해주세요.');
            }

            const fileArray = Array.from(uniqueFiles);
            // 이전 업로드의 ctx가 남아 있으면 백그라운드 이벤트·재시도가 그쪽을 본다. 새 업로드로 바로 바꾼다.
            const ctx = createUploadContext(tripKey!, fileArray, { postUploadTask, precomputedMetadata });
            uploadContextRef.current = ctx;
            setUploadStats({ total: fileArray.length, succeeded: 0, failed: 0 });
            setDuplicateCount(0);
            setUploadPhase('preparing');
            trackUploadStarted(ctx, source);

            let markPrepared!: () => void;
            const prepared = new Promise<void>((resolve) => {
                markPrepared = resolve;
            });
            const chain = startChain(ctx, 'initial', markPrepared);
            const started = await Promise.race([
                prepared.then(() => true),
                chain.then(
                    () => true,
                    () => false,
                ),
            ]);
            return { started };
        },
        [tripKey, startChain, source],
    );

    /*
     * 끝나지 않은 일을 이어서 하는 새 체인을 띄우고 돌려준다. 할 일이 없으면 undefined.
     * 이전 체인은 먼저 abort해 남은 요청이 새 체인과 겹쳐 돌지 않게 한다.
     */
    const runRetry = useCallback(
        (trigger: UploadTrigger): Promise<void> | undefined => {
            const ctx = uploadContextRef.current;
            if (!ctx || !hasPendingWork(ctx)) return undefined;
            ctx.abortController.abort();
            ctx.abortController = new AbortController();
            return startChain(ctx, trigger);
        },
        [startChain],
    );
    // 재시도 버튼용. onClick에 그대로 넘겨도 이벤트 객체가 trigger로 들어가지 않게 인자를 받지 않는다.
    const retryFailedUploads = useCallback((): void => {
        void runRetry('manual_retry');
    }, [runRetry]);

    /*
     * '그래도 올리기'. 중복으로 빠진 파일만 중복 검사 없이 다시 발급받아 올린다.
     * 진행 중인 체인이 있으면 끝난 뒤에 돈다. 중간에 대상을 바꾸면 그 체인이 못 올린 파일로 센다.
     */
    const uploadDuplicates = useCallback((): void => {
        const ctx = uploadContextRef.current;
        if (!ctx || ctx.duplicateIndices.size === 0 || duplicateUploadQueuedRef.current === ctx) return;
        duplicateUploadQueuedRef.current = ctx;
        setDuplicateCount(0);
        const run = () => {
            duplicateUploadQueuedRef.current = null;
            if (uploadContextRef.current !== ctx) return undefined;
            acceptDuplicates(ctx);
            return runRetry('allow_duplicates');
        };
        const bg = bgUploadPromiseRef.current;
        if (!bg || !uploadInProgressRef.current) {
            void run();
            return;
        }
        // 기다리는 쪽(티켓 발급 단계 등)이 지금 체인만 보고 넘어가지 않게, 기다릴 promise를 곧바로 이 업로드로 바꾼다.
        const queued = bg.then(run, run);
        bgUploadPromiseRef.current = queued;
        queued.catch(() => {});
        queued
            .finally(() => {
                // 체인을 띄우지 않고 끝났으면(새 업로드로 바뀜) 진행 중 표시를 여기서 푼다
                if (bgUploadPromiseRef.current === queued) uploadInProgressRef.current = false;
            })
            .catch(() => {});
    }, [runRetry]);

    /*
     * 기다리는 사이 재시도·'그래도 올리기'가 새 체인으로 바꿨으면 그 체인까지 기다린다. 결과는 마지막 체인의 것이다.
     * TripCreateCompleteStep의 effect deps에 들어가므로 identity가 바뀌면 안 된다(바뀌면 렌더마다 정보 저장 PUT이 다시 나간다).
     */
    const waitForBackgroundUpload = useCallback(async () => {
        for (;;) {
            const { current } = bgUploadPromiseRef;
            if (!current) return;
            try {
                await current;
            } catch (error) {
                if (bgUploadPromiseRef.current === current) throw error;
                continue;
            }
            if (bgUploadPromiseRef.current === current) return;
        }
    }, []);

    // Wi-Fi가 끊기면 진행 중인 요청을 일괄 abort하고, 돌아오면 끝나지 않은 일을 자동으로 이어 올린다.
    useEffect(() => {
        const onOffline = () => {
            uploadContextRef.current?.abortController.abort();
        };
        const onOnline = () => {
            if (!uploadContextRef.current) return;
            // 진행 중인 체인이 실패를 다 모으기 전에 새 체인을 띄우면 두 체인이 동시에 돈다. 끝난 뒤에 재시도한다.
            // 그사이 다른 실행(수동 재시도·'그래도 올리기')이 시작됐으면 그쪽이 남은 일을 하므로 끊지 않고 건너뛴다.
            // 할 일이 없으면 runRetry가 스스로 건너뛴다.
            const attemptRetry = () => {
                if (!uploadInProgressRef.current) void runRetry('online_retry');
            };
            const bg = bgUploadPromiseRef.current;
            if (bg) bg.then(attemptRetry, attemptRetry);
            else attemptRetry();
        };
        window.addEventListener('offline', onOffline);
        window.addEventListener('online', onOnline);
        return () => {
            window.removeEventListener('offline', onOffline);
            window.removeEventListener('online', onOnline);
        };
    }, [runRetry]);

    /*
     * 업로드 중 화면이 가려지면(홈 버튼, 앱 전환, 화면 꺼짐) 그 시점의 진행 상태를 남긴다.
     * Android는 백그라운드 WebView를 언제든 죽일 수 있어서, 이 이벤트 뒤에 upload_finished가 없으면
     * 백그라운드에서 죽은 것으로 본다. 가려지는 순간에 보내야 프로세스가 죽기 전에 전송될 가능성이 높다.
     */
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState !== 'hidden' || !uploadInProgressRef.current) return;
            const ctx = uploadContextRef.current;
            if (!ctx) return;
            const { telemetry } = ctx;
            track(
                ANALYTICS_EVENTS.UPLOAD_BACKGROUNDED,
                {
                    upload_id: telemetry.uploadId,
                    source,
                    attempt: telemetry.attempts,
                    total: telemetry.total,
                    succeeded: ctx.transferred.size,
                    elapsed_ms: Date.now() - telemetry.startedAt,
                },
                /*
                 * 일괄 전송 대기열을 거치면 Android가 백그라운드 WebView를 죽일 때 같이 사라진다.
                 * sendBeacon은 CapacitorHttp가 가로채지 않는 브라우저 전송이라, 업로드로 붐비는 네이티브 통로도 피한다.
                 */
                { send_instantly: true, transport: 'sendBeacon' },
            );
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [source]);

    // 업로드 전에 날짜를 확인하는 호출부용. 진행률(metadata)도 갱신한다.
    const extractMetadata = useCallback((files: readonly File[]) => extractMetadataFromImage(files, setProgress), []);

    return {
        images,
        extractMetadata,
        imageCategories,
        progress,
        uploadStats,
        uploadPhase,
        duplicateCount,
        prepareUploadFiles,
        uploadImagesToS3,
        retryFailedUploads,
        uploadDuplicates,
        waitForBackgroundUpload,
    };
};
