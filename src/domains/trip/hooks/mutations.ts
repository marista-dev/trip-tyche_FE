import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Trip } from '@/domains/trip/types';
import { tripAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';

export const useTripDelete = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (tripKey: string) => toResult(() => tripAPI.deleteTripTicket(tripKey)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket-list'] });
        },
    });
};

export const useTripFormSubmit = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ tripKey, tripForm }: { tripKey: string; tripForm: Trip }) =>
            toResult(() => tripAPI.updateTripForm(tripKey, tripForm), {
                onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: ['ticket-list'] });
                    queryClient.invalidateQueries({ queryKey: ['ticket-info', tripKey] });
                },
            }),
    });
};
