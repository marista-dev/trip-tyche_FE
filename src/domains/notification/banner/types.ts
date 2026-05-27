export type BannerType =
    | 'SHARED_REQUEST'
    | 'SHARED_APPROVE'
    | 'SHARED_REJECTED'
    | 'TRIP_UPDATED'
    | 'TRIP_DELETED'
    | 'MEDIA_FILE_ADDED'
    | 'MEDIA_FILE_UPDATED'
    | 'MEDIA_FILE_DELETED';

export interface BannerMessage {
    id: number;
    type: BannerType;
    senderNickname: string;
    tripTitle?: string;
    tripKey?: string;
    shareId?: number;
    notificationId?: number;
    count?: number;
}

export type BannerInput = Omit<BannerMessage, 'id'>;
