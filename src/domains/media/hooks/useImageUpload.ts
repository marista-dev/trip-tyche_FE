import { useRef, useState } from 'react';

import { useParams } from 'react-router-dom';

import { DEFAULT_METADATA } from '@/domains/media/constants';
import {
    PresignedUrlResponse,
    ClientImageFile,
    ImageProcessStatusType,
    MediaFileCategories,
} from '@/domains/media/types';
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

async function uploadWithRetry(presignedPutUrl: string, file: File): Promise<void> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= UPLOAD_RETRY_ATTEMPTS; attempt++) {
        try {
            await mediaAPI.uploadToS3(presignedPutUrl, file);
            return;
        } catch (e) {
            lastErr = e;
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
}

export const useImageUpload = () => {
    const [images, setImages] = useState<ClientImageFile[]>();
    const [imageCategories, setImageCategories] = useState<MediaFileCategories>();
    const [currentProcess, setCurrentProcess] = useState<ImageProcessStatusType>('metadata');
    const [progress, setProgress] = useState({
        metadata: 0,
        upload: 0,
    });
    const [uploadStats, setUploadStats] = useState<UploadStats>({ total: 0, succeeded: 0, failed: 0 });
    const bgUploadPromiseRef = useRef<Promise<void> | null>(null);
    const uploadContextRef = useRef<UploadContext | null>(null);

    const { tripKey } = useParams();

    const extractMetaData = async (images: FileList): Promise<FileList> => {
        setCurrentProcess('metadata');
        const imagesWithoutHeic = await convertHeicToJpg(images);
        const uniqueImages = removeDuplicateImages(imagesWithoutHeic);
        return uniqueImages;
    };

    const submitMetadata = async (images: ClientImageFile[], presignedUrls: PresignedUrlResponse[]) => {
        const metaDatas = presignedUrls.map((url: PresignedUrlResponse, index: number) => {
            const { recordDate, latitude, longitude } = images[index];
            return {
                fileKey: url.fileKey,
                latitude: latitude || DEFAULT_METADATA.LOCATION,
                longitude: longitude || DEFAULT_METADATA.LOCATION,
                recordDate: recordDate || DEFAULT_METADATA.DATE,
            };
        });
        await mediaAPI.createMediaFileMetadata(tripKey!, metaDatas);
    };

    // 지정한 인덱스만 업로드 → (이미 끝난 단계가 아닐 경우) 메타등록 → postUploadTask 순차 실행.
    // 초기 업로드와 retry 양쪽에서 재사용. ctx의 플래그로 idempotency를 보장한다.
    const buildUploadChain = (ctx: UploadContext, indicesToUpload: number[]): Promise<void> =>
        (async () => {
            if (indicesToUpload.length > 0) {
                await runWithPool(indicesToUpload, MAX_CONCURRENT_S3_UPLOADS, async (index: number) => {
                    try {
                        await uploadWithRetry(ctx.presignedUrls[index].presignedPutUrl, ctx.fileArray[index]);
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
        })();

    // postUploadTask는 S3 업로드 + 메타등록 이후에 같은 체인으로 묶어 실행할 작업(예: status 전환).
    // 실패 시 step3의 waitForBackgroundUpload에서 함께 surface되어 retry UI로 노출된다.
    const uploadImagesToS3 = async (uniqueFiles: FileList, postUploadTask?: () => Promise<unknown>) => {
        const setRejected = (err: unknown) => {
            const failed = Promise.reject(err instanceof Error ? err : new Error(String(err)));
            failed.catch(() => {});
            bgUploadPromiseRef.current = failed;
            uploadContextRef.current = null;
        };

        try {
            const fileArray = Array.from(uniqueFiles);
            const imageNames = fileArray.map((file) => ({ fileName: file.name }));

            const [imagesWithMetadata, presignedResult] = await Promise.all([
                extractMetadataFromImage(uniqueFiles, setProgress),
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
            };
            uploadContextRef.current = ctx;

            const allIndices = Array.from({ length: presignedUrls.length }, (_, i) => i);
            const rawUpload = buildUploadChain(ctx, allIndices);
            bgUploadPromiseRef.current = rawUpload;
            rawUpload.catch(() => {});
        } catch (err) {
            setRejected(err);
        }
    };

    // step3 retry 버튼이 호출. 실패한 인덱스만 다시 업로드 → 남은 chain(메타등록/status 전환)을 이어서 실행.
    // bgUploadPromiseRef를 새 promise로 교체하므로, 호출 직후 waitForBackgroundUpload는 새 진행 상태를 await한다.
    const retryFailedUploads = (): void => {
        const ctx = uploadContextRef.current;
        if (!ctx) return;

        const toRetry = Array.from(ctx.failedIndices);
        // 실패 카운터만 초기화 → 진행률이 신선하게 보임. succeeded는 누적 유지.
        setUploadStats((s) => ({ ...s, failed: 0 }));

        const newUpload = buildUploadChain(ctx, toRetry);
        bgUploadPromiseRef.current = newUpload;
        newUpload.catch(() => {});
    };

    const waitForBackgroundUpload = async () => {
        if (bgUploadPromiseRef.current) await bgUploadPromiseRef.current;
    };

    return {
        images,
        imageCategories,
        currentProcess,
        progress,
        uploadStats,
        extractMetaData,
        uploadImagesToS3,
        retryFailedUploads,
        waitForBackgroundUpload,
    };
};
