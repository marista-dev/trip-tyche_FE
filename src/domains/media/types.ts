import { Location } from '@/shared/types/map';

export type ImageUploadStepType = 'upload' | 'processing' | 'review' | 'info' | 'done';

interface MetaData extends Location {
    recordDate: string;
}

export interface MediaFile extends MetaData {
    mediaFileId: number;
    mediaLink: string;
    /** 격자·목록용 축소본. 썸네일 도입 전에 처리된 사진과 지도 /info 응답은 null/없음이라 mediaLink로 대체한다 */
    thumbnailLink?: string | null;
}

export interface MediaFileCategories {
    withAll: {
        count: number;
        images?: MediaFile[];
    };
    withoutLocation: {
        count: number;
        images?: MediaFile[];
    };
    withoutDate: {
        count: number;
        images?: MediaFile[];
    };
}

export interface ClientImageFile extends MetaData {
    image: File;
}

/** presign 요청의 파일 하나. size·contentType이 있으면 서버가 둘 다 서명에 묶고, size·recordDate가 있으면 중복을 검사한다. */
export interface PresignFileInfo {
    fileName: string;
    contentType?: string;
    size?: number;
    /** yyyy-MM-ddTHH:mm:ss. 날짜가 없는 사진은 보내지 않는다(기본값끼리 중복으로 잡힌다). */
    recordDate?: string;
}

/** 요청과 같은 순서로 온다. 중복(duplicate)이면 행·서명이 만들어지지 않아 duplicateOfMediaFileId 외에는 모두 null이다. */
export interface PresignedUrlResponse {
    mediaFileId: number | null;
    fileKey: string | null;
    tempKey: string | null;
    finalKey: string | null;
    presignedPutUrl: string | null;
    /** UTC ISO */
    expiresAt: string | null;
    /** 서명에 묶인 Content-Type. PUT은 이 값을 그대로 보내야 한다(다르면 403). */
    contentType: string | null;
    duplicate: boolean;
    duplicateOfMediaFileId: number | null;
}

export interface PresignRenewResponse {
    presignedUrls: PresignedUrlResponse[];
    skipped: { mediaFileId: number; reason: 'NOT_FOUND' | 'ALREADY_REGISTERED' }[];
}

export type ProcessingStatus = 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'LEGACY';

export interface MediaFileItem {
    mediaFileId: number;
    currentUrl: string;
    finalUrl: string;
    status: ProcessingStatus;
    processedAt?: string | null;
    failureReason?: string | null;
}

/** 처리 요청 응답 항목. 행이 없으면(고아 정리로 지워짐) NOT_FOUND이고 URL이 없다. */
export type MediaRequestItem =
    | MediaFileItem
    | { mediaFileId: number; currentUrl: null; finalUrl: null; status: 'NOT_FOUND' };

/** 재처리 응답 항목. 임시 원본이 사라졌으면 SOURCE_MISSING이다(삭제 후 다시 올려야 한다). */
export type ReprocessItem =
    | MediaRequestItem
    | { mediaFileId: number; currentUrl: string | null; finalUrl: string | null; status: 'SOURCE_MISSING' };

export interface MediaProcessedPayload {
    mediaFileId: number;
    finalUrl?: string;
    status: 'PROCESSED' | 'FAILED';
    processedAt?: string;
    reason?: string;
}
