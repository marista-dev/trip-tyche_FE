/** 알림 쿼리 키 */
export const notificationKeys = {
    all: ['notification'] as const,
    list: (userId: number) => ['notification', userId] as const,
    detail: (notificationId: number) => ['notificationId-detail', notificationId] as const,
};
