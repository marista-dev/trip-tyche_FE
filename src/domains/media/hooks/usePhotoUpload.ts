import { useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { PendingPhoto } from '@/domains/media/components/manage/DateGroupSection';
import { useImageUpload } from '@/domains/media/hooks/useImageUpload';
import { useToastStore } from '@/shared/stores/useToastStore';

type UploadPhase = 'idle' | 'extracting' | 'uploading';

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
export const usePhotoUpload = (tripKey: string) => {
    const queryClient = useQueryClient();
    const { showToast } = useToastStore();
    const { prepareUploadFiles, uploadImagesToS3, waitForBackgroundUpload, progress } = useImageUpload();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
    const [pendingByDate, setPendingByDate] = useState<Record<string, PendingPhoto[]>>({});

    const openFilePicker = () => {
        if (uploadPhase !== 'idle') return;
        fileInputRef.current?.click();
    };

    const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const inputEl = event.target;
        const files = inputEl.files;

        if (!files || files.length === 0) {
            inputEl.value = '';
            return;
        }

        const fileArray: File[] = Array.from(files);
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
            const uniqueFiles = await prepareUploadFiles(files);
            setUploadPhase('uploading');
            // uploadImagesToS3는 백그라운드 chain을 띄우고 즉시 return → waitForBackgroundUpload로
            // 실제 S3 PUT + metadata POST 완료까지 await.
            await uploadImagesToS3(uniqueFiles);
            await waitForBackgroundUpload();

            await queryClient.invalidateQueries({ queryKey: ['trip-images', tripKey] });
            showToast(`${uniqueFiles.length}장의 사진이 추가되었어요`);
        } catch {
            showToast('사진 추가 중 문제가 발생했어요. 다시 시도해주세요.');
        } finally {
            setUploadPhase('idle');
            setPendingByDate({});
            inputEl.value = '';
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
    };
};
