import { useQuery } from '@tanstack/react-query';

import { notificationKeys } from '@/domains/notification/queryKeys';
import { notificationAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';

export const useNotificationList = (userId: number) => {
    return useQuery({
        queryKey: notificationKeys.list(userId),
        queryFn: () => toResult(() => notificationAPI.fetchNotificationList(userId)),
        staleTime: 0,
    });
};

export const useNotificationDetail = (notificationId: number) => {
    return useQuery({
        queryKey: notificationKeys.detail(notificationId),
        queryFn: () => toResult(() => notificationAPI.fetchNotificationDetail(notificationId)),
    });
};
