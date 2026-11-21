import { MediaFile } from '@/domains/media/types';
import { PinPoint } from '@/domains/route/types';

type Success<T> = { success: true; data: T };
type Error = {
    success: false;
    error: string;
    /** HTTP 상태. 응답 없이 실패(네트워크·시간 초과)했으면 없다. */
    status?: number;
    /** 서버 ResultCode(예: 5008 지원하지 않는 형식) */
    code?: number;
};

export type Result<T> = Success<T> | Error;

export interface ApiResponse<T> {
    status: number;
    code: number;
    message: string;
    data: T;
    httpStatus: string;
}

export interface RouteResponse {
    tripTitle: string;
    startDate: string;
    endDate: string;
    mediaFiles: MediaFile[];
    pinPoints: PinPoint[];
}

export interface MediaByPinPoint {
    pinPointId: number;
    mediaFiles: MediaFile[];
}

export interface MediaByDate {
    recordDate: string;
    mediaFiles: MediaFile[];
}

// export interface ShareDetailResponse extends Trip {}
