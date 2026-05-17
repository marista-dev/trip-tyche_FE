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

// 브라우저(특히 Safari)의 동일 origin 동시 연결 제한을 고려해 명시적으로 제한.
// 너무 크면 queue가 쌓이며 stall timer가 false-positive abort를 일으킬 수 있다.
const MAX_CONCURRENT_S3_UPLOADS = 3;

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

export const useImageUpload = () => {
    const [images, setImages] = useState<ClientImageFile[]>();
    const [imageCategories, setImageCategories] = useState<MediaFileCategories>();
    const [currentProcess, setCurrentProcess] = useState<ImageProcessStatusType>('metadata');
    const [progress, setProgress] = useState({
        metadata: 0,
        upload: 0,
    });
    const bgUploadPromiseRef = useRef<Promise<void> | null>(null);

    const { tripKey } = useParams();

    const extractMetaData = async (images: FileList): Promise<FileList> => {
        setCurrentProcess('metadata');
        const imagesWithoutHeic = await convertHeicToJpg(images);
        const uniqueImages = removeDuplicateImages(imagesWithoutHeic);
        return uniqueImages;
    };

    // postUploadTask는 S3 업로드 + 메타등록 이후에 같은 체인으로 묶어 실행할 작업(예: status 전환).
    // 실패 시 step3의 waitForBackgroundUpload에서 함께 surface되어 retry UI로 노출된다.
    const uploadImagesToS3 = async (uniqueFiles: FileList, postUploadTask?: () => Promise<unknown>) => {
        const setRejected = (err: unknown) => {
            const failed = Promise.reject(err instanceof Error ? err : new Error(String(err)));
            failed.catch(() => {});
            bgUploadPromiseRef.current = failed;
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

            // S3 업로드 완료 후 메타데이터 등록 (순서 보장 — 워커가 originals/ 접근 전 파일 존재 보장)
            let rawUpload: Promise<void> = runWithPool(
                presignedUrls,
                MAX_CONCURRENT_S3_UPLOADS,
                (urlInfo: PresignedUrlResponse, index: number) =>
                    mediaAPI.uploadToS3(urlInfo.presignedPutUrl, fileArray[index]),
            ).then(() => submitMetadata(imagesWithMetadata, presignedUrls));
            if (postUploadTask) {
                rawUpload = rawUpload.then(() => postUploadTask()).then(() => undefined);
            }
            bgUploadPromiseRef.current = rawUpload;
            rawUpload.catch(() => {});
        } catch (err) {
            setRejected(err);
        }
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

    const waitForBackgroundUpload = async () => {
        if (bgUploadPromiseRef.current) await bgUploadPromiseRef.current;
    };

    return {
        images,
        imageCategories,
        currentProcess,
        progress,
        extractMetaData,
        uploadImagesToS3,
        waitForBackgroundUpload,
    };
};
