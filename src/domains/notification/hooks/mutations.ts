import { useMutation, useQueryClient } from '@tanstack/react-query';

import { notificationKeys } from '@/domains/notification/queryKeys';
import { SUMMARY_QUERY_KEY } from '@/domains/user/queryKeys';
import { notificationAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';

export const useNotificationStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (notificationId: number) =>
            toResult(() => notificationAPI.updateNotificationStatus(notificationId)),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
                queryClient.invalidateQueries({ queryKey: SUMMARY_QUERY_KEY }),
            ]);
        },
    });
};

export const useNotificationDelete = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (notificationIds: number[]) => toResult(() => notificationAPI.deleteNotification(notificationIds)),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
                queryClient.invalidateQueries({ queryKey: SUMMARY_QUERY_KEY }),
            ]);
        },
    });
};
