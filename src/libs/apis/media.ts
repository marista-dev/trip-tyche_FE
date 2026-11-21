import axios from 'axios';

import type {
    MediaFile,
    MediaFileItem,
    MediaRequestItem,
    PresignFileInfo,
    PresignedUrlResponse,
    PresignRenewResponse,
    ReprocessItem,
} from '@/domains/media/types';
import { UploadAbortError, UploadHttpError, type UploadAbortReason } from '@/domains/media/utils/uploadTelemetry';
import { apiClient } from '@/libs/apis/shared/client';
import { ApiResponse, MediaByDate, MediaByPinPoint, Result } from '@/libs/apis/shared/types';
import { toResult } from '@/libs/apis/shared/utils';
import { exceptTimeFromDateString } from '@/libs/utils/date';
import { isNative } from '@/platform';
import { Location } from '@/shared/types/map';

/*
 * S3 PUT 타이머. 첫 progress(실제 전송 시작) 뒤 30초간 진행이 없으면 멈춘 것으로 보고 끊는다.
 * 대기열에 있는 요청은 progress가 없으므로 정지 타이머를 미리 걸지 않는다(Safari 연결 제한 환경의 오탐 방지).
 * 끊긴 Wi-Fi에서 응답 없이 매달린 요청은 첫 progress 상한으로 끊는다. 전송이 시작되면 정지 타이머가 이어받아,
 * 느린 망에서 큰 파일이 오래 걸리는 것만으로는 끊지 않는다.
 */
const S3_STALL_TIMEOUT_MS = 30_000;
const S3_FIRST_PROGRESS_TIMEOUT_MS = 120_000;
/*
 * CapacitorHttp 경로는 progress가 오지 않아 위 상한이 전송 전체에 걸린다. 그래서 파일 크기만큼 늘린다.
 * 느린 셀룰러에서 6개를 동시에 보내도 끝나게 연결당 약 1Mbps(1MB에 8초)로 넉넉히 잡는다.
 */
const S3_NO_PROGRESS_MS_PER_MB = 8_000;
const BYTES_PER_MB = 1024 * 1024;
/*
 * 메타데이터 등록 요청만 길게 둔다. 50장 묶음은 서버 처리가 기본 10초를 넘길 수 있다.
 * 이제 등록 API가 멱등이라 끊겨도 같은 묶음을 다시 보내면 되지만, 짧게 끊으면 느린 서버에서 매번 시간 초과로
 * 같은 묶음을 되풀이하게 된다. 그래서 한 번을 충분히 기다린다.
 */
const REGISTER_TIMEOUT_MS = 60_000;

/** native-bridge.js가 CapacitorHttp로 바꿔치기하기 전에 보관해 둔 원본 XHR 함수들 */
interface CapacitorWebXhr {
    constructor: typeof XMLHttpRequest;
    open: (this: XMLHttpRequest, method: string, url: string) => void;
    setRequestHeader: XMLHttpRequest['setRequestHeader'];
    send: XMLHttpRequest['send'];
    abort: XMLHttpRequest['abort'];
}

/*
 * CapacitorHttp가 켜진 앱에서는 axios(XHR)의 S3 PUT 본문을 JS에서 base64로 바꿔 네이티브로 넘긴다.
 * 큰 파일일수록 메모리·시간이 들고, 업로드 progress가 오지 않아 stall 타이머가 돌지 않으며, abort도 네이티브 요청을 끊지 못한다.
 * 플래그가 켜져 있으면 원본 XHR로 WebView가 직접 보낸다. 버킷 CORS가 앱 origin(https://localhost)의 PUT·Content-Type을 허용해야 한다.
 */
const getCapacitorWebXhr = (): CapacitorWebXhr | null => {
    if (import.meta.env.VITE_S3_DIRECT_UPLOAD !== 'true' || !isNative()) return null;
    return (window as Window & { CapacitorWebXMLHttpRequest?: CapacitorWebXhr }).CapacitorWebXMLHttpRequest ?? null;
};

/** S3 PUT이 원본 XHR로 나가는지. 업로드 추적 이벤트가 두 경로의 실패율을 나눠 보려고 쓴다. */
export const isDirectS3Upload = () => getCapacitorWebXhr() !== null;

/*
 * 원본 생성자로 만들어도 프로토타입의 open/send 등은 이미 패치돼 있다(native-bridge가 공유 프로토타입을 덮어쓴다).
 * 그래서 보관된 원본 함수를 call로 직접 부른다.
 */
const putWithWebXhr = (
    webXhr: CapacitorWebXhr,
    url: string,
    file: File,
    contentType: string,
    signal: AbortSignal,
    onProgress: () => void,
): Promise<void> =>
    new Promise((resolve, reject) => {
        const xhr = new webXhr.constructor();
        const onAbort = () => webXhr.abort.call(xhr);
        const cleanup = () => signal.removeEventListener('abort', onAbort);
        xhr.upload.addEventListener('progress', onProgress);
        xhr.addEventListener('load', () => {
            cleanup();
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new UploadHttpError(xhr.status));
        });
        // 응답 없이 끊김(오프라인, CORS 거부 포함) → network로 분류된다
        xhr.addEventListener('error', () => {
            cleanup();
            reject(new UploadHttpError(null));
        });
        // 호출부가 abortReason으로 UploadAbortError를 만든다
        xhr.addEventListener('abort', () => {
            cleanup();
            reject(new Error('aborted'));
        });
        if (signal.aborted) {
            reject(new Error('aborted'));
            return;
        }
        signal.addEventListener('abort', onAbort);
        webXhr.open.call(xhr, 'PUT', url);
        webXhr.setRequestHeader.call(xhr, 'Content-Type', contentType);
        webXhr.send.call(xhr, file);
    });

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
    // 미디어 파일 업로드를 위한 Presigned URL 생성. allowDuplicates는 '그래도 올리기'(중복 검사 생략)
    requestPresignedUrls: (
        tripKey: string,
        files: PresignFileInfo[],
        { allowDuplicates = false }: { allowDuplicates?: boolean } = {},
    ): Promise<Result<PresignedUrlResponse[]>> =>
        toResult(
            async (): Promise<ApiResponse<{ presignedUrls: PresignedUrlResponse[] }>> =>
                await apiClient.post(`/v1/trips/${tripKey}/presigned-url`, {
                    files,
                    ...(allowDuplicates ? { allowDuplicates } : {}),
                }),
            {
                transform: (data) => data.presignedUrls,
                errorMessage: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
            },
        ),
    // 같은 행·키로 PUT URL만 다시 서명받는다. 행이 없거나 이미 등록된 id는 skipped로 온다.
    renewPresignedUrls: (tripKey: string, mediaFileIds: number[]): Promise<Result<PresignRenewResponse>> =>
        toResult(
            async (): Promise<ApiResponse<PresignRenewResponse>> =>
                await apiClient.post(`/v1/trips/${tripKey}/presigned-url/renew`, { mediaFileIds }),
            { errorMessage: '업로드 주소를 다시 받지 못했습니다.' },
        ),
    // S3 스토리지로 미디어 파일 업로드. presigned URL로 직접 보내므로 apiClient의 timeout이 없어 자체 타이머를 둔다.
    // externalSignal은 hook이 일괄 abort(예: offline 이벤트)할 때 쓴다. 두 전송 경로(axios / 직접 XHR)가 같은 타이머를 쓴다.
    // contentType은 서명에 묶인 값이다. 서명된 Content-Length와 맞게 file은 presign에 크기를 보낸 그 파일이어야 한다.
    uploadToS3: async (presignedUrl: string, file: File, contentType: string, externalSignal?: AbortSignal) => {
        const controller = new AbortController();
        let stallTimer: ReturnType<typeof setTimeout> | null = null;
        // 누가 끊었는지 기록해 둔다. 업로드 추적 이벤트가 정지·시간 초과·외부 취소를 나눠 센다.
        let abortReason: UploadAbortReason | null = null;
        const abortWith = (reason: UploadAbortReason) => {
            if (abortReason) return;
            abortReason = reason;
            controller.abort();
        };

        const onExternalAbort = () => abortWith('external');
        if (externalSignal) {
            if (externalSignal.aborted) abortWith('external');
            else externalSignal.addEventListener('abort', onExternalAbort);
        }

        const webXhr = getCapacitorWebXhr();
        // 직접 XHR은 progress가 오므로 연결 상한만 둔다. axios는 CapacitorHttp에서 progress가 없어 크기만큼 늘린다.
        const noProgressTimeoutMs = webXhr
            ? S3_FIRST_PROGRESS_TIMEOUT_MS
            : S3_FIRST_PROGRESS_TIMEOUT_MS + (file.size / BYTES_PER_MB) * S3_NO_PROGRESS_MS_PER_MB;
        const noProgressTimer = setTimeout(() => abortWith('wall_clock'), noProgressTimeoutMs);
        const onProgress = () => {
            clearTimeout(noProgressTimer);
            if (stallTimer) clearTimeout(stallTimer);
            stallTimer = setTimeout(() => abortWith('stall'), S3_STALL_TIMEOUT_MS);
        };
        try {
            if (webXhr) {
                await putWithWebXhr(webXhr, presignedUrl, file, contentType, controller.signal, onProgress);
            } else {
                await axios.put(presignedUrl, file, {
                    headers: {
                        'Content-Type': contentType,
                    },
                    signal: controller.signal,
                    onUploadProgress: onProgress,
                });
            }
        } catch (error) {
            if (abortReason) throw new UploadAbortError(abortReason);
            throw error;
        } finally {
            if (stallTimer) clearTimeout(stallTimer);
            clearTimeout(noProgressTimer);
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
    triggerMediaProcessing: (
        tripKey: string,
        items: { mediaFileId: number; recordDate: string; latitude: number; longitude: number }[],
    ): Promise<Result<MediaRequestItem[]>> =>
        toResult(
            // 항목별로 멱등이다. 이미 등록된 행은 현재 상태로 오고, 없는 행은 NOT_FOUND로 온다.
            async (): Promise<ApiResponse<{ items: MediaRequestItem[] }>> =>
                await apiClient.post(
                    `/v1/trips/${tripKey}/media-files/processing`,
                    { items },
                    { timeout: REGISTER_TIMEOUT_MS },
                ),
            {
                transform: (data) => data.items,
                errorMessage: '미디어 처리 요청에 실패했습니다.',
            },
        ),
    // FAILED 사진을 다시 처리한다. FAILED가 아닌 행은 현재 상태 그대로 온다(멱등).
    reprocessMedia: (tripKey: string, mediaFileIds: number[]): Promise<Result<ReprocessItem[]>> =>
        toResult(
            async (): Promise<ApiResponse<{ items: ReprocessItem[] }>> =>
                await apiClient.post(`/v1/trips/${tripKey}/media-files/reprocess`, { mediaFileIds }),
            {
                transform: (data) => data.items,
                errorMessage: '사진을 다시 처리하지 못했습니다.',
            },
        ),
    fetchUploadStatus: (tripKey: string): Promise<Result<MediaFileItem[]>> =>
        toResult(
            async (): Promise<ApiResponse<{ items: MediaFileItem[] }>> =>
                await apiClient.get(`/v1/trips/${tripKey}/media-files/upload-status`),
            {
                transform: (data) => data.items,
                errorMessage: '업로드 상태를 불러오지 못했습니다.',
            },
        ),
};
