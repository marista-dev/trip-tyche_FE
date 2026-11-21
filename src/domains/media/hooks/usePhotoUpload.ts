import { useEffect, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { PendingPhoto } from '@/domains/media/components/manage/DateGroupSection';
import { useImageUpload } from '@/domains/media/hooks/useImageUpload';
import { isUploadInProgress } from '@/domains/media/hooks/useUploadGuard';
import { invalidateTripMedia } from '@/domains/media/queryKeys';
import { describeDuplicates, describeUploadError, describeUploadProgress } from '@/domains/media/utils/uploadMessages';
import type { PickerReport } from '@/domains/media/utils/uploadValidation';
import { getDateBounds, getDatesOutside, toDateString, toPhotoDays, TripRange } from '@/domains/trip/tripDates';
import { ANALYTICS_EVENTS, track } from '@/libs/analytics';
import { summarizeUploadFormats } from '@/libs/utils/image';
import { isIOSWeb, isNative } from '@/platform';
import { pickImagesFromGallery } from '@/platform/native/gallery';
import { useToastStore } from '@/shared/stores/useToastStore';

const UPLOAD_ERROR_FALLBACK = '사진 추가 중 문제가 발생했어요. 다시 시도해주세요.';

// 이 화면의 흐름 단계. 실제 전송 단계(useImageUpload의 uploadPhase)와 달리 날짜 확인 시트를 기다리는 시간도 포함한다.
type FlowPhase = 'idle' | 'extracting' | 'uploading';

/** 기간 밖에 찍힌 사진이 있을 때 물을 내용 */
export interface DateConflict {
    /** 정렬·중복 제거됨 */
    outsideDates: string[];
    outsideCount: number;
    totalCount: number;
    current: TripRange;
    /** 기존 기간과 새 사진을 모두 담는 기간 */
    extended: TripRange;
}

export type DateConflictChoice = 'extend' | 'keep' | 'cancel';

interface UsePhotoUploadOptions {
    /** 없으면(작성 중인 여행) 날짜 확인을 건너뛴다. */
    tripRange?: TripRange | null;
    /** false를 돌려주면 업로드를 멈춘다. */
    onExtendRange?: (range: TripRange) => Promise<boolean>;
}

/**
 * 사진 관리 페이지의 파일 추가 흐름을 캡슐화하는 훅.
 *
 * 책임:
 *  - 숨김 파일 input ref + 파일 picker 오픈
 *  - 파일 선택 즉시 placeholder(blob 미리보기 + recordDate 기반 날짜 그룹) 생성
 *  - prepareUploadFiles → uploadImagesToS3 → waitForBackgroundUpload → invalidate 시퀀스
 *  - 실패하면 남은 사진을 다시 올리는 동작을 노출하고, 재시도(수동·온라인 복귀)가 성공하면 목록을 다시 받아 알린다
 *  - blob URL revoke를 double rAF로 지연 (DOM 제거 후 회수)
 *  - 진행 phase별 텍스트 노출
 *
 * iOS Safari/모바일 호환성:
 *  - input.files를 Array.from으로 즉시 스냅샷 → reset이 FileList를 무효화하는 버그 회피
 *  - input.value = '' reset은 finally(모든 await 종료 후)로 미뤄 FileList 무효화 차단
 *  - DataTransfer 의존 없음 (extractMetaData/useImageUpload 내부 다 File[]로 통일됨)
 */
export const usePhotoUpload = (tripKey: string, { tripRange, onExtendRange }: UsePhotoUploadOptions = {}) => {
    const queryClient = useQueryClient();
    const { showToast } = useToastStore();
    const invalidatePhotos = () => invalidateTripMedia(queryClient, tripKey);
    const {
        prepareUploadFiles,
        extractMetadata,
        uploadImagesToS3,
        retryFailedUploads,
        uploadDuplicates: startDuplicateUpload,
        waitForBackgroundUpload,
        progress,
        uploadStats,
        uploadPhase: transferPhase,
        duplicateCount,
        imageCategories,
    } = useImageUpload({
        source: 'manage',
        // 첫 실행이 실패해 processFiles는 이미 끝났다. 수동·온라인 복귀 재시도가 나머지를 올린 경우다.
        onRecovered: () => {
            void invalidatePhotos();
            showToast('사진이 추가되었어요');
        },
    });
    // 성공 토스트를 띄울 때는 이미 렌더가 끝나 있으므로, 이번 업로드의 분류를 effect로 옮겨 둔 값을 읽는다.
    const withoutLocationRef = useRef(0);
    const duplicateCountRef = useRef(0);
    useEffect(() => {
        withoutLocationRef.current = imageCategories?.withoutLocation.count ?? 0;
    }, [imageCategories]);
    useEffect(() => {
        duplicateCountRef.current = duplicateCount;
    }, [duplicateCount]);
    const isTransferring = isUploadInProgress(transferPhase);

    // processFiles가 이 Promise로 사용자의 선택을 기다린다.
    const [dateConflict, setDateConflict] = useState<DateConflict | null>(null);
    const conflictResolverRef = useRef<((choice: DateConflictChoice) => void) | null>(null);

    const settleConflict = (choice: DateConflictChoice) => {
        conflictResolverRef.current?.(choice);
        conflictResolverRef.current = null;
    };

    const askDateConflict = (conflict: DateConflict) =>
        new Promise<DateConflictChoice>((resolve) => {
            conflictResolverRef.current = resolve;
            setDateConflict(conflict);
        });

    const resolveDateConflict = (choice: DateConflictChoice) => {
        settleConflict(choice);
        setDateConflict(null);
    };

    // 시트가 뜬 채 언마운트되면 취소로 끝내 finally(미리보기 URL 해제)가 돌게 한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => () => settleConflict('cancel'), []);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadPhase, setUploadPhase] = useState<FlowPhase>('idle');
    const [pendingByDate, setPendingByDate] = useState<Record<string, PendingPhoto[]>>({});

    // 네이티브에서는 EXIF 원본을 보존하는 갤러리 피커를, 웹에서는 기존 file input을 쓴다.
    const openFilePicker = async () => {
        // 온라인 복귀 재시도가 도는 중에도 새 업로드는 시작할 수 없다(uploadImagesToS3가 거부한다).
        if (uploadPhase !== 'idle' || isTransferring) return;

        if (isNative()) {
            // 영상만 고른 경우도 prepareUploadFiles가 안내한다. 아무 반응이 없으면 앱이 멈춘 것처럼 보인다.
            const { files, skippedNonImage, locationNotice } = await pickImagesFromGallery();
            await processFiles(files, undefined, { skippedNonImage, notice: locationNotice });
            return;
        }

        fileInputRef.current?.click();
    };

    const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const inputEl = event.target;
        const { files } = inputEl;

        if (!files || files.length === 0) {
            inputEl.value = '';
            return;
        }

        await processFiles(Array.from(files), () => {
            inputEl.value = '';
        });
    };

    // 파일 출처(웹 input / 네이티브 피커)와 무관한 공통 업로드 시퀀스.
    const processFiles = async (fileArray: File[], resetInput?: () => void, pick?: PickerReport) => {
        // 중복·형식·용량 검사는 즉시 끝난다. 제외할 사진의 미리보기를 잠깐 띄웠다 지우지 않게 먼저 거른다.
        const uniqueFiles = await prepareUploadFiles(fileArray, pick);
        if (uniqueFiles.length === 0) {
            // 제외 안내는 prepareUploadFiles가 이미 띄웠다
            resetInput?.();
            return;
        }

        const createdUrls: string[] = [];

        // INSTANT: extractMetaData가 끝나기 전에 미리보기 placeholder를 그리드에 즉시 띄움.
        const initialPending: Record<string, PendingPhoto[]> = {};
        const stampBatch = Date.now();
        uniqueFiles.forEach((file, idx) => {
            const stamp = Number.isFinite(file.lastModified) ? file.lastModified : Date.now();
            const dateKey = toDateString(new Date(stamp));
            let previewUrl: string;
            try {
                previewUrl = URL.createObjectURL(file);
                createdUrls.push(previewUrl);
            } catch {
                previewUrl = '';
            }
            const list = initialPending[dateKey] ?? [];
            list.push({ id: `pending-${stampBatch}-${idx}`, previewUrl });
            initialPending[dateKey] = list;
        });
        setPendingByDate(initialPending);
        setUploadPhase('extracting');

        try {
            // 기간이 있으면 올리기 전에 날짜를 확인해야 해서 EXIF를 먼저 읽는다. 없으면 업로드가 presign과 함께 읽는다.
            const metadata = tripRange ? await extractMetadata(uniqueFiles) : undefined;

            // 올린 뒤가 아니라 올리기 전에 묻는다 — 잘못 고른 사진을 서버에서 지우는 수고를 덜려고.
            if (tripRange && metadata) {
                const days = toPhotoDays(metadata.map((m) => m.recordDate));
                const outsideDates = getDatesOutside(days, tripRange.start, tripRange.end);
                if (outsideDates.length > 0) {
                    const bounds = getDateBounds([...days, tripRange.start, tripRange.end])!;
                    const choice = await askDateConflict({
                        outsideDates,
                        outsideCount: days.filter((d) => outsideDates.includes(d)).length,
                        totalCount: uniqueFiles.length,
                        current: tripRange,
                        extended: bounds,
                    });
                    if (choice === 'cancel') {
                        showToast('사진 추가를 취소했어요');
                        return;
                    }
                    if (choice === 'extend' && onExtendRange && !(await onExtendRange(bounds))) return;
                }
            }

            setUploadPhase('uploading');
            // uploadImagesToS3는 준비·URL 발급이 끝나면 돌아온다. 전송·등록이 끝날 때까지는 waitForBackgroundUpload로 기다린다.
            await uploadImagesToS3(uniqueFiles, undefined, metadata);
            await waitForBackgroundUpload();

            await invalidatePhotos();
            // 장수·형식·용량만 보낸다. 파일명·tripKey는 식별 정보라 속성에 넣지 않는다.
            track(ANALYTICS_EVENTS.PHOTOS_UPLOADED, { ...summarizeUploadFormats(uniqueFiles), ios_web: isIOSWeb() });
            // 제외 안내와 겹치지 않게 위치 없는 사진 안내는 마지막 토스트에 붙인다. 카드가 바로 아래에 생긴다.
            const withoutLocation = withoutLocationRef.current;
            // 이미 있는 사진은 올리지 않았다. '그래도 올리기'는 화면의 버튼으로 연다.
            const duplicates = duplicateCountRef.current;
            const added = uniqueFiles.length - duplicates;
            showToast(
                [
                    added > 0 && `${added}장의 사진이 추가되었어요`,
                    describeDuplicates(duplicates),
                    withoutLocation > 0 && `${withoutLocation}장은 위치 정보가 없어 '위치 정보 없음'에 모아뒀어요`,
                ]
                    .filter(Boolean)
                    .join('. '),
            );
        } catch (error) {
            // 50장 단위로 등록되므로 실패해도 앞서 등록된 묶음은 서버에 있다. 그 사진들을 목록에 보인다.
            void invalidatePhotos();
            showToast(describeUploadError(error, UPLOAD_ERROR_FALLBACK));
        } finally {
            setUploadPhase('idle');
            setPendingByDate({});
            resetInput?.();
            // blob URL은 React가 다음 paint에서 DOM을 제거한 뒤 회수 (broken image 깜빡임 방지)
            const urlsToRevoke = createdUrls.slice();
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    urlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
                });
            });
        }
    };

    // 끝내지 못한 일이 남은 채 흐름이 끝났다. 온라인 복귀를 기다리지 않고 직접 다시 시도할 수 있게 한다.
    const canRetryUpload = uploadPhase === 'idle' && transferPhase === 'failed';
    const retryUpload = async () => {
        if (!canRetryUpload) return;
        retryFailedUploads();
        try {
            // 성공하면 onRecovered가 목록을 갱신하고 알린다
            await waitForBackgroundUpload();
        } catch (error) {
            void invalidatePhotos();
            showToast(describeUploadError(error, UPLOAD_ERROR_FALLBACK));
        }
    };

    // 중복으로 빠진 사진을 그래도 올린다. 성공하면 onRecovered가 목록을 갱신하고 알린다.
    const canUploadDuplicates = uploadPhase === 'idle' && !isTransferring && duplicateCount > 0;
    const uploadDuplicates = async () => {
        if (!canUploadDuplicates) return;
        startDuplicateUpload();
        try {
            await waitForBackgroundUpload();
        } catch (error) {
            void invalidatePhotos();
            showToast(describeUploadError(error, UPLOAD_ERROR_FALLBACK));
        }
    };

    // 시트 뒤에 '분석 중 100%'가 남지 않게 숨긴다. 재시도(수동·온라인 복귀)는 processFiles 밖에서 돌아 전송 단계만 본다.
    const uploadingText = dateConflict
        ? undefined
        : uploadPhase === 'extracting'
          ? `사진 정보를 분석 중... ${Math.round(progress?.metadata ?? 0)}%`
          : (describeUploadProgress(transferPhase, uploadStats) ??
            (uploadPhase === 'uploading' ? '사진 업로드 중…' : undefined));

    return {
        fileInputRef,
        openFilePicker,
        handleFileSelected,
        uploadPhase,
        isUploading: uploadPhase !== 'idle' || isTransferring,
        /** 실제 전송 중. 화면 이탈 차단·꺼짐 방지(useUploadGuard)에 쓴다. */
        isTransferring,
        uploadingText,
        canRetryUpload,
        retryUpload,
        duplicateCount,
        canUploadDuplicates,
        uploadDuplicates,
        pendingByDate,
        dateConflict,
        resolveDateConflict,
    };
};
