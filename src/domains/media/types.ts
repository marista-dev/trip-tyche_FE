import { Location } from '@/shared/types/map';

export type ImageUploadStepType = 'upload' | 'processing' | 'review' | 'info' | 'done';

interface MetaData extends Location {
    recordDate: string;
}

export interface MediaFile extends MetaData {
    mediaFileId: number;
    mediaLink: string;
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

export interface PresignedUrlResponse {
    mediaFileId: number;
    tempKey: string;
    finalKey: string;
    presignedPutUrl: string;
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

export interface MediaProcessedPayload {
    mediaFileId: number;
    finalUrl?: string;
    status: 'PROCESSED' | 'FAILED';
    processedAt?: string;
    reason?: string;
}
