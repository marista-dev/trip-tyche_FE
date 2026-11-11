import { useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { PendingPhoto } from '@/domains/media/components/manage/DateGroupSection';
import { useImageUpload } from '@/domains/media/hooks/useImageUpload';
import { getDateBounds, getDatesOutside, toPhotoDays } from '@/domains/trip/tripDates';
import { ANALYTICS_EVENTS, track } from '@/libs/analytics';
import { isNative } from '@/platform';
import { pickImagesFromGallery } from '@/platform/native/gallery';
import { useToastStore } from '@/shared/stores/useToastStore';

type UploadPhase = 'idle' | 'extracting' | 'uploading';

export interface TripRange {
    start: string;
    end: string;
}

/** 추가하려는 사진 중 여행 기간 밖에 찍힌 것이 있을 때 사용자에게 물을 내용 */
export interface DateConflict {
    /** 기간 밖 촬영일(정렬, 중복 없음) */
    outsideDates: string[];
    /** 기간 밖 사진 장수 */
    outsideCount: number;
    totalCount: number;
    current: TripRange;
    /** 기존 기간과 새 사진을 모두 담는 기간 */
    extended: TripRange;
}

export type DateConflictChoice = 'extend' | 'keep' | 'cancel';

interface UsePhotoUploadOptions {
    /** 확정된 여행 기간. 없으면(작성 중인 여행) 날짜 확인을 건너뛴다. */
    tripRange?: TripRange | null;
    /** '기간 늘리기'를 고르면 호출. 실패하면 false를 돌려 업로드를 멈춘다. */
    onExtendRange?: (range: TripRange) => Promise<boolean>;
}

/**
 * 사진 관리 페이지의 파일 추가 흐름을 캡슐화하는 훅.
 *
 * 책임:
 *  - 숨김 파일 input ref + 파일 picker 오픈
 *  - 파일 선택 즉시 placeholder(blob 미리보기 + recordDate 기반 날짜 그룹) 생성
 *  - prepareUploadFiles → uploadImagesToS3 → waitForBackgroundUpload → invalidate 시퀀스
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
    const { prepareUploadFiles, extractMetadata, uploadImagesToS3, waitForBackgroundUpload, progress } =
        useImageUpload();

    // 날짜 확인 시트 — processFiles가 사용자의 선택을 기다린다.
    const [dateConflict, setDateConflict] = useState<DateConflict | null>(null);
    const conflictResolverRef = useRef<((choice: DateConflictChoice) => void) | null>(null);

    const askDateConflict = (conflict: DateConflict) =>
        new Promise<DateConflictChoice>((resolve) => {
            conflictResolverRef.current = resolve;
            setDateConflict(conflict);
        });

    const resolveDateConflict = (choice: DateConflictChoice) => {
        conflictResolverRef.current?.(choice);
        conflictResolverRef.current = null;
        setDateConflict(null);
    };

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
    const [pendingByDate, setPendingByDate] = useState<Record<string, PendingPhoto[]>>({});

    // 네이티브에서는 EXIF 원본을 보존하는 갤러리 피커를, 웹에서는 기존 file input을 쓴다.
    const openFilePicker = async () => {
        if (uploadPhase !== 'idle') return;

        if (isNative()) {
            const pickedFiles = await pickImagesFromGallery();
            if (pickedFiles.length > 0) await processFiles(pickedFiles);
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
    const processFiles = async (fileArray: File[], resetInput?: () => void) => {
        const createdUrls: string[] = [];

        // INSTANT: extractMetaData가 끝나기 전에 미리보기 placeholder를 그리드에 즉시 띄움.
        const initialPending: Record<string, PendingPhoto[]> = {};
        const stampBatch = Date.now();
        fileArray.forEach((file, idx) => {
            const stamp = Number.isFinite(file.lastModified) ? file.lastModified : Date.now();
            const d = new Date(stamp);
            const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
            const uniqueFiles = await prepareUploadFiles(fileArray);
            const metadata = await extractMetadata(uniqueFiles);

            /*
             * 여행 기간 밖에 찍힌 사진이면 올리기 전에 묻는다. 올린 뒤에 알려주면 잘못 고른 사진이
             * 이미 서버에 있어 지우는 수고가 생긴다. 날짜만 비교한다(시각은 보지 않는다).
             */
            if (tripRange?.start && tripRange?.end) {
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
            // uploadImagesToS3는 백그라운드 chain을 띄우고 즉시 return → waitForBackgroundUpload로
            // 실제 S3 PUT + metadata POST 완료까지 await.
            await uploadImagesToS3(uniqueFiles, undefined, metadata);
            await waitForBackgroundUpload();

            await queryClient.invalidateQueries({ queryKey: ['trip-images', tripKey] });
            // 장수만 보낸다. 파일명·tripKey는 식별 정보라 속성에 넣지 않는다.
            track(ANALYTICS_EVENTS.PHOTOS_UPLOADED, { count: uniqueFiles.length });
            showToast(`${uniqueFiles.length}장의 사진이 추가되었어요`);
        } catch {
            showToast('사진 추가 중 문제가 발생했어요. 다시 시도해주세요.');
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

    const uploadingText =
        uploadPhase === 'extracting'
            ? `사진 정보를 분석 중... ${Math.round(progress?.metadata ?? 0)}%`
            : uploadPhase === 'uploading'
              ? `사진 업로드 중... ${Math.round(progress?.upload ?? 0)}%`
              : undefined;

    return {
        fileInputRef,
        openFilePicker,
        handleFileSelected,
        uploadPhase,
        isUploading: uploadPhase !== 'idle',
        uploadingText,
        pendingByDate,
        dateConflict,
        resolveDateConflict,
    };
};
