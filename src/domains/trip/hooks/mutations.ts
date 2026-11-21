import { useMutation, useQueryClient } from '@tanstack/react-query';

import { routeKeys } from '@/domains/route/queryKeys';
import { invalidateTripLists, tripKeys } from '@/domains/trip/queryKeys';
import { Trip } from '@/domains/trip/types';
import { tripAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';

export const useTripDelete = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (tripKey: string) => toResult(() => tripAPI.deleteTripTicket(tripKey)),
        onSuccess: () => {
            void invalidateTripLists(queryClient);
        },
    });
};

export const useTripFormSubmit = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ tripKey, tripForm }: { tripKey: string; tripForm: Trip }) =>
            toResult(() => tripAPI.updateTripForm(tripKey, tripForm), {
                onSuccess: () => {
                    void invalidateTripLists(queryClient);
                    queryClient.invalidateQueries({ queryKey: tripKeys.info(tripKey) });
                    // 경로 화면 상단의 제목·기간도 이 응답에 들어 있다
                    queryClient.invalidateQueries({ queryKey: routeKeys.detail(tripKey) });
                },
            }),
    });
};
