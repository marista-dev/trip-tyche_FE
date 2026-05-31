import { useCallback, useEffect, useRef, useState } from 'react';

import { useParams } from 'react-router-dom';

import { DEFAULT_METADATA } from '@/domains/media/constants';
import { useUploadSessionStore } from '@/domains/media/stores/useUploadSessionStore';
import { PresignedUrlResponse, ClientImageFile, MediaFileCategories } from '@/domains/media/types';
import { filterWithoutDateMediaFile, filterWithoutLocationMediaFile } from '@/domains/media/utils';
import { mediaAPI } from '@/libs/apis';
import { convertHeicToJpg, extractMetadataFromImage, removeDuplicateImages } from '@/libs/utils/image';

// HTTP/2 엔드포인트(OCI compat S3 포함)는 단일 TCP 위에서 100+ stream을 동시 처리 가능 →
// 사실상 "한 번에 다 시작"이 throughput 최대. HTTP/1.1로 떨어지는 환경에선 브라우저가 6개씩
// 자동으로 queue 처리하므로 큰 숫자여도 안전(progress-aware stall timer 덕분에 queue abort 없음).
// 영구 실패는 retryFailedUploads로 부분 재업로드 가능하므로 공격적인 동시성을 채택한다.
const MAX_CONCURRENT_S3_UPLOADS = 200;

// 일시적 네트워크 단절(iOS '네트워크 연결이 유실되었습니다' 등)을 자동 흡수하기 위한 per-file 재시도.
const UPLOAD_RETRY_ATTEMPTS = 2; // 첫 시도 + 2회 재시도 = 최대 3회

// limit개의 워커가 풀처럼 items를 소비. Promise.all을 그대로 쓰면 N개 모두를 동시 시작하므로 부적합.
async function runWithPool<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        let i = next++;
        while (i < items.length) {
            results[i] = await worker(items[i], i);
            i = next++;
        }
    });
    await Promise.all(runners);
    return results;
}

async function uploadWithRetry(presignedPutUrl: string, file: File, signal: AbortSignal): Promise<void> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= UPLOAD_RETRY_ATTEMPTS; attempt++) {
        if (signal.aborted) throw new Error('aborted');
        try {
            await mediaAPI.uploadToS3(presignedPutUrl, file, signal);
            return;
        } catch (e) {
            lastErr = e;
            // offline 상태에서 backoff 낭비 + 좀비 socket 추가 생성 방지 — abort 즉시 종료
            if (signal.aborted) throw e;
            if (attempt < UPLOAD_RETRY_ATTEMPTS) {
                // 1s, 2s 지수 backoff. 일시적 단절은 보통 수 초 내 회복.
                await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
            }
        }
    }
    throw lastErr;
}

export interface UploadStats {
    total: number;
    succeeded: number;
    failed: number;
}

// 업로드 chain의 재시도 단계를 추적하기 위한 컨텍스트.
// 실패한 인덱스만 다시 업로드 → 이미 끝난 단계(메타등록/status 전환)는 건너뛴다.
interface UploadContext {
    fileArray: File[];
    presignedUrls: PresignedUrlResponse[];
    imagesWithMetadata: ClientImageFile[];
    postUploadTask?: () => Promise<unknown>;
    failedIndices: Set<number>;
    metadataSubmitted: boolean;
    postUploadTaskCompleted: boolean;
    // offline 이벤트로 일괄 abort, 또는 retry 시 새 controller로 교체.
    // 좀비 socket이 device pool을 점유하기 전에 명시적으로 끊는 것이 핵심.
    abortController: AbortController;
}

export const useImageUpload = () => {
    const [images, setImages] = useState<ClientImageFile[]>();
    const [imageCategories, setImageCategories] = useState<MediaFileCategories>();
    const [progress, setProgress] = useState({
        metadata: 0,
        upload: 0,
    });
    const [uploadStats, setUploadStats] = useState<UploadStats>({ total: 0, succeeded: 0, failed: 0 });
    const bgUploadPromiseRef = useRef<Promise<void> | null>(null);
    const uploadContextRef = useRef<UploadContext | null>(null);
    // 동시 업로드 가드 — 두 번째 트리거가 첫 번째 promise를 ref에서 덮어써 orphan이 되는 것을 차단.
    // 호출 측에서 uploadPhase 가드를 두지만, 훅 레벨에서도 방어.
    const uploadInProgressRef = useRef(false);

    const { tripKey } = useParams();

    const prepareUploadFiles = useCallback(async (images: FileList): Promise<File[]> => {
        const imagesWithoutHeic = await convertHeicToJpg(images);
        const uniqueImages = removeDuplicateImages(imagesWithoutHeic);
        return uniqueImages;
    }, []);

    const submitMetadata = useCallback(
        async (images: ClientImageFile[], presignedUrls: PresignedUrlResponse[]) => {
            const items = presignedUrls.map((url: PresignedUrlResponse, index: number) => {
                const { recordDate, latitude, longitude } = images[index];
                return {
                    mediaFileId: url.mediaFileId,
                    latitude: latitude || DEFAULT_METADATA.LOCATION,
                    longitude: longitude || DEFAULT_METADATA.LOCATION,
                    recordDate: recordDate || DEFAULT_METADATA.DATE,
                };
            });
            const result = await mediaAPI.triggerMediaProcessing(tripKey!, items);
            if (!result.success) {
                throw new Error(result.error);
            }
            useUploadSessionStore.getState().initialize(tripKey!, result.data);
        },
        [tripKey],
    );

    // 지정한 인덱스만 업로드 → (이미 끝난 단계가 아닐 경우) 메타등록 → postUploadTask 순차 실행.
    // 초기 업로드와 retry 양쪽에서 재사용. ctx의 플래그로 idempotency를 보장한다.
    // ctx.abortController는 offline 이벤트로 일괄 abort 되며, 모든 단계가 같은 signal을 공유한다.
    const buildUploadChain = useCallback(
        (ctx: UploadContext, indicesToUpload: number[]): Promise<void> =>
            (async () => {
                const { signal } = ctx.abortController;
                if (indicesToUpload.length > 0) {
                    await runWithPool(indicesToUpload, MAX_CONCURRENT_S3_UPLOADS, async (index: number) => {
                        try {
                            await uploadWithRetry(
                                ctx.presignedUrls[index].presignedPutUrl,
                                ctx.fileArray[index],
                                signal,
                            );
                            ctx.failedIndices.delete(index);
                            setUploadStats((s) => ({ ...s, succeeded: s.succeeded + 1 }));
                        } catch {
                            ctx.failedIndices.add(index);
                            setUploadStats((s) => ({ ...s, failed: s.failed + 1 }));
                            // 던지지 않음 — 풀이 끝까지 돌며 모든 실패를 누적하고, 끝난 뒤 한 번에 판단
                        }
                    });
                }
                if (ctx.failedIndices.size > 0) {
                    throw new Error(`${ctx.failedIndices.size}장 업로드 실패`);
                }
                if (!ctx.metadataSubmitted) {
                    await submitMetadata(ctx.imagesWithMetadata, ctx.presignedUrls);
                    ctx.metadataSubmitted = true;
                }
                if (ctx.postUploadTask && !ctx.postUploadTaskCompleted) {
                    await ctx.postUploadTask();
                    ctx.postUploadTaskCompleted = true;
                }
            })(),
        [submitMetadata],
    );

    // postUploadTask는 S3 업로드 + 메타등록 이후에 같은 체인으로 묶어 실행할 작업(예: status 전환).
    // 실패 시 step3의 waitForBackgroundUpload에서 함께 surface되어 retry UI로 노출된다.
    const uploadImagesToS3 = useCallback(
        async (uniqueFiles: readonly File[], postUploadTask?: () => Promise<unknown>) => {
            if (uploadInProgressRef.current) {
                throw new Error('이미 진행 중인 업로드가 있습니다. 완료 후 다시 시도해주세요.');
            }
            uploadInProgressRef.current = true;

            const setRejected = (err: unknown) => {
                const failed = Promise.reject(err instanceof Error ? err : new Error(String(err)));
                failed.catch(() => {});
                bgUploadPromiseRef.current = failed;
                uploadContextRef.current = null;
                uploadInProgressRef.current = false;
            };

            try {
                const fileArray = Array.from(uniqueFiles);
                const imageNames = fileArray.map((file) => ({ fileName: file.name }));

                const [imagesWithMetadata, presignedResult] = await Promise.all([
                    extractMetadataFromImage(fileArray, setProgress),
                    mediaAPI.requestPresignedUrls(tripKey!, imageNames),
                ]);

                if (!presignedResult.success) {
                    setRejected(new Error(presignedResult.error));
                    return;
                }
                const presignedUrls = presignedResult.data;

                setImages(imagesWithMetadata);
                setImageCategories({
                    withAll: { count: imagesWithMetadata.length || 0 },
                    withoutLocation: { count: filterWithoutLocationMediaFile(imagesWithMetadata).length || 0 },
                    withoutDate: { count: filterWithoutDateMediaFile(imagesWithMetadata).length || 0 },
                });

                // 업로드 진행 상태를 step3에 노출하기 위한 카운터 초기화
                setUploadStats({ total: presignedUrls.length, succeeded: 0, failed: 0 });

                const ctx: UploadContext = {
                    fileArray,
                    presignedUrls,
                    imagesWithMetadata,
                    postUploadTask,
                    failedIndices: new Set(),
                    metadataSubmitted: false,
                    postUploadTaskCompleted: false,
                    abortController: new AbortController(),
                };
                uploadContextRef.current = ctx;

                const allIndices = Array.from({ length: presignedUrls.length }, (_, i) => i);
                const rawUpload = buildUploadChain(ctx, allIndices);
                bgUploadPromiseRef.current = rawUpload;
                rawUpload.catch(() => {});
                // chain 종료(성공/실패 무관) 시 in-progress 플래그 해제 — 다음 업로드 가능 상태로 복귀
                rawUpload.finally(() => {
                    uploadInProgressRef.current = false;
                });
            } catch (err) {
                setRejected(err);
            }
        },
        [tripKey, buildUploadChain],
    );

    // step3 retry 버튼이 호출. 실패한 인덱스만 다시 업로드 → 남은 chain(메타등록/status 전환)을 이어서 실행.
    // bgUploadPromiseRef를 새 promise로 교체하므로, 호출 직후 waitForBackgroundUpload는 새 진행 상태를 await한다.
    // race fix: 이전 controller가 살아있는 상태에서 새 controller로 단순 교체하면 좀비 chain이 백그라운드에서
    // 계속 동작할 수 있음 → 새 controller 만들기 전에 명시적으로 abort. 또한 in-progress 플래그 다시 설정해
    // 같은 ctx 위에서 retry되는 동안 다른 업로드가 끼어들지 않도록 한다.
    const retryFailedUploads = useCallback((): void => {
        const ctx = uploadContextRef.current;
        if (!ctx) return;

        // 이전 chain의 잔여 요청을 명시적으로 abort
        ctx.abortController.abort();

        const toRetry = Array.from(ctx.failedIndices);
        // 실패 카운터만 초기화 → 진행률이 신선하게 보임. succeeded는 누적 유지.
        setUploadStats((s) => ({ ...s, failed: 0 }));

        ctx.abortController = new AbortController();
        uploadInProgressRef.current = true;
        const newUpload = buildUploadChain(ctx, toRetry);
        bgUploadPromiseRef.current = newUpload;
        newUpload.catch(() => {});
        newUpload.finally(() => {
            uploadInProgressRef.current = false;
        });
    }, [buildUploadChain]);

    // 함수 identity가 매 render마다 바뀌면 step3의 runPhases deps가 흔들려 useEffect가 무한 fire됨.
    // (TripCreateCompleteStep#runPhases가 deps로 사용 → bg 진행 중 setUploadStats가 발화할 때마다 PUT 폭주 위험)
    const waitForBackgroundUpload = useCallback(async () => {
        if (bgUploadPromiseRef.current) await bgUploadPromiseRef.current;
    }, []);

    // Wi-Fi 끊김 즉시 in-flight 요청을 일괄 abort → 좀비 socket 차단.
    // 회복(online) 시 실패 인덱스가 있으면 자동 재시도 → 사용자 클릭 없이도 이어서 업로드.
    useEffect(() => {
        const onOffline = () => {
            uploadContextRef.current?.abortController.abort();
        };
        const onOnline = () => {
            const ctx = uploadContextRef.current;
            if (!ctx) return;
            // 진행 중인 chain이 실패 인덱스를 다 모으기 전에 다음 단계로 넘어가지 않도록,
            // bgUploadPromise가 reject된 뒤에만 재시도. 그렇지 않으면 두 chain이 동시 실행될 수 있음.
            const bg = bgUploadPromiseRef.current;
            const attemptRetry = () => {
                if (ctx.failedIndices.size > 0 || !ctx.metadataSubmitted || !ctx.postUploadTaskCompleted) {
                    retryFailedUploads();
                }
            };
            if (bg) {
                bg.then(attemptRetry, attemptRetry);
            } else {
                attemptRetry();
            }
        };
        window.addEventListener('offline', onOffline);
        window.addEventListener('online', onOnline);
        return () => {
            window.removeEventListener('offline', onOffline);
            window.removeEventListener('online', onOnline);
        };
    }, [retryFailedUploads]);

    return {
        images,
        imageCategories,
        progress,
        uploadStats,
        prepareUploadFiles,
        uploadImagesToS3,
        retryFailedUploads,
        waitForBackgroundUpload,
    };
};
