import { useMutation, useQueryClient } from '@tanstack/react-query';

import { shareKeys } from '@/domains/share/queryKeys';
import { invalidateTripLists } from '@/domains/trip/queryKeys';
import { shareAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';

export const useShareStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ shareId, status }: { shareId: number; status: string }) =>
            toResult(() => shareAPI.updateShareStatus(shareId, status)),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: shareKeys.all }),
                // 수락한 여행이 지구본에도 바로 보이게
                invalidateTripLists(queryClient),
            ]);
        },
    });
};

export const useShareUnlink = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (shareId: number) => toResult(() => shareAPI.unlinkShared(shareId)),
        onSuccess: async () => {
            await invalidateTripLists(queryClient);
        },
    });
};
