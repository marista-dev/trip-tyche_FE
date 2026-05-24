export type NotificationMessage =
    | 'SHARED_REQUEST'
    | 'SHARED_APPROVE'
    | 'SHARED_REJECTED'
    | 'TRIP_UPDATED'
    | 'TRIP_DELETED'
    | 'MEDIA_FILE_ADDED'
    | 'MEDIA_FILE_UPDATED'
    | 'MEDIA_FILE_DELETED'
    | 'NOTICE_INCOMPLETE'
    | 'NOTICE_FEATURE'
    | 'NOTICE_BACKUP';

export type NotificationStatus = 'READ' | 'UNREAD';
export type NotificationKind = 'share' | 'notice';

export const NOTIFICATION_KIND: Record<NotificationMessage, NotificationKind> = {
    SHARED_REQUEST: 'share',
    SHARED_APPROVE: 'share',
    SHARED_REJECTED: 'share',
    TRIP_UPDATED: 'share',
    TRIP_DELETED: 'share',
    MEDIA_FILE_ADDED: 'share',
    MEDIA_FILE_UPDATED: 'share',
    MEDIA_FILE_DELETED: 'share',
    NOTICE_INCOMPLETE: 'notice',
    NOTICE_FEATURE: 'notice',
    NOTICE_BACKUP: 'notice',
};

export interface Notification {
    notificationId: number;
    referenceId: number;
    message: NotificationMessage;
    status: NotificationStatus;
    senderNickname: string;
    createdAt: string;
}
