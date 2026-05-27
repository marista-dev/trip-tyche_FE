import axios from 'axios';

import { PresignedUrlResponse, MediaFile, MediaFileItem } from '@/domains/media/types';
import { apiClient } from '@/libs/apis/shared/client';
import { ApiResponse, MediaByDate, MediaByPinPoint, Result } from '@/libs/apis/shared/types';
import { exceptTimeFromDateString } from '@/libs/utils/date';
import { Location } from '@/shared/types/map';

export const mediaAPI = {
    // 핀포인트별 미디어 파일 조회
    fetchMediaByPinPoint: async (tripKey: string, pinPointId: string): Promise<ApiResponse<MediaByPinPoint>> =>
        await apiClient.get(`/v1/trips/${tripKey}/pinpoints/${pinPointId}/images`),
    // 날짜별 미디어 파일 조회
    fetchMediaByDate: async (tripKey: string, dateString: string): Promise<ApiResponse<MediaByDate>> => {
        const onlyDate = exceptTimeFromDateString(dateString);
        return await apiClient.get(`/v1/trips/${tripKey}/map?date=${onlyDate}`);
    },
    // 위치 정보 없는 이미지 목록 조회
    fetchUnlocatedImages: async (tripKey: string) => await apiClient.get(`/v1/trips/${tripKey}/media-files/unlocated`),
    // 위치 정보 없는 이미지 위치 업데이트
    updateUnlocatedImages: async (tripKey: string, mediaFileId: number, location: Location) => {
        const data = await apiClient.patch(`/v1/trips/${tripKey}/media-files/unlocated/${mediaFileId}`, location);
        return data.data;
    },
    // 미디어 파일 업로드를 위한 Presigned URL 생성
    requestPresignedUrls: async (
        tripKey: string,
        imageNames: { fileName: string }[],
    ): Promise<Result<PresignedUrlResponse[]>> => {
        try {
            const response = await apiClient.post(`/v1/trips/${tripKey}/presigned-url`, { files: imageNames });
            return { success: true, data: response.data.presignedUrls };
        } catch {
            return { success: false, error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' };
        }
    },
    // S3 스토리지로 미디어 파일 업로드
    // raw axios.put은 기본 timeout이 없어 느린/끊긴 네트워크에서 영원히 pending 상태가 됨.
    // 첫 onUploadProgress(=실제 전송 시작) 이후, 30초간 progress가 없으면 stall로 간주하고 abort.
    // 브라우저 queue 대기 중인 요청은 progress 이벤트가 없으므로 타이머를 사전 시작하지 않는다
    // (Safari 2-connection 제한 + 다수 파일 환경에서 queue request를 false-positive abort하던 버그 회피).
    // wall-clock timeout(120s)도 둠 — Wi-Fi 끊김으로 좀비 socket 상태가 됐을 때 무한 hang 방지.
    // externalSignal은 hook이 일괄 abort(예: offline 이벤트)할 때 사용.
    uploadToS3: async (presignedUrl: string, file: File, externalSignal?: AbortSignal) => {
        const STALL_TIMEOUT_MS = 30_000;
        const WALL_CLOCK_TIMEOUT_MS = 120_000;
        const controller = new AbortController();
        let stallTimer: ReturnType<typeof setTimeout> | null = null;

        const onExternalAbort = () => controller.abort();
        if (externalSignal) {
            if (externalSignal.aborted) controller.abort();
            else externalSignal.addEventListener('abort', onExternalAbort);
        }

        const resetStallTimer = () => {
            if (stallTimer) clearTimeout(stallTimer);
            stallTimer = setTimeout(() => controller.abort(), STALL_TIMEOUT_MS);
        };
        const wallClockTimer = setTimeout(() => controller.abort(), WALL_CLOCK_TIMEOUT_MS);
        try {
            await axios.put(presignedUrl, file, {
                headers: {
                    'Content-Type': file.type,
                },
                signal: controller.signal,
                onUploadProgress: resetStallTimer,
            });
        } finally {
            if (stallTimer) clearTimeout(stallTimer);
            clearTimeout(wallClockTimer);
            externalSignal?.removeEventListener('abort', onExternalAbort);
        }
    },
    // 여행에 등록된 모든 이미지 조회
    getTripImages: async (
        tripKey: string,
    ): Promise<
        ApiResponse<{
            startDate: string;
            endDate: string;
            mediaFiles: MediaFile[];
        }>
    > => await apiClient.get(`/v1/trips/${tripKey}/media-files`),
    // 선택한 여행 이미지 삭제
    deleteImages: async (tripKey: string, images: number[]): Promise<ApiResponse<string>> =>
        await apiClient.delete(`/v1/trips/${tripKey}/media-files`, {
            data: { mediaFileIds: images },
        }),
    // 선택한 여행 이미지 수정
    updateMediaFileMetadata: async (tripKey: string, images: MediaFile[]): Promise<ApiResponse<string>> =>
        await apiClient.patch(`/v1/trips/${tripKey}/media-files`, {
            mediaFiles: images,
        }),
    updateTripStatusToImagesUploaded: async (tripKey: string): Promise<ApiResponse<string>> =>
        await apiClient.patch(`/v1/trips/${tripKey}/images-uploaded`),
    triggerMediaProcessing: async (
        tripKey: string,
        items: { mediaFileId: number; recordDate: string; latitude: number; longitude: number }[],
    ): Promise<Result<MediaFileItem[]>> => {
        try {
            const response = await apiClient.post(`/v1/trips/${tripKey}/media-files/processing`, { items });
            return { success: true, data: response.data.items };
        } catch {
            return { success: false, error: '미디어 처리 요청에 실패했습니다.' };
        }
    },
    fetchUploadStatus: async (tripKey: string): Promise<Result<MediaFileItem[]>> => {
        try {
            const response = await apiClient.get(`/v1/trips/${tripKey}/media-files/upload-status`);
            return { success: true, data: response.data.items };
        } catch {
            return { success: false, error: '업로드 상태를 불러오지 못했습니다.' };
        }
    },
};
