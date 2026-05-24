import { useMutation, useQueryClient } from '@tanstack/react-query';

import { notificationAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';

export const useNotificationStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (notificationId: number) =>
            toResult(() => notificationAPI.updateNotificationStatus(notificationId)),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['notification'] }),
                queryClient.invalidateQueries({ queryKey: ['summary'] }),
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
                queryClient.invalidateQueries({ queryKey: ['notification'] }),
                queryClient.invalidateQueries({ queryKey: ['summary'] }),
            ]);
        },
    });
};
