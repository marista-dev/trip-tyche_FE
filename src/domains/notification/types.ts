export type NotificationMessage =
    | 'SHARED_REQUEST'
    | 'SHARED_APPROVE'
    | 'SHARED_REJECTED'
    | 'NOTICE_INCOMPLETE'
    | 'NOTICE_FEATURE'
    | 'NOTICE_BACKUP';

export type NotificationStatus = 'READ' | 'UNREAD';
export type NotificationKind = 'share' | 'notice';

export const NOTIFICATION_KIND: Record<NotificationMessage, NotificationKind> = {
    SHARED_REQUEST: 'share',
    SHARED_APPROVE: 'share',
    SHARED_REJECTED: 'share',
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
