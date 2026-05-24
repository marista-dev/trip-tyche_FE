import { useMutation, useQueryClient } from '@tanstack/react-query';

import { shareAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';

export const useShareStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ shareId, status }: { shareId: number; status: string }) =>
            toResult(() => shareAPI.updateShareStatus(shareId, status)),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['share'] }),
                queryClient.invalidateQueries({ queryKey: ['ticket-list'] }),
            ]);
        },
    });
};

export const useShareUnlink = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (shareId: number) => toResult(() => shareAPI.unlinkShared(shareId)),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['ticket-list'] });
        },
    });
};
