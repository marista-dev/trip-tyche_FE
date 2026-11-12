import { useEffect, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { routeAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';
import { ROUTES } from '@/shared/constants/route';

const PLANE_FLIGHT_MS = 1050;

interface OpenTripOptions {
    /** 비행기 대신 쓰는 퇴장 효과. 끝나면 받은 함수로 이동한다 */
    playExitEffect?: (navigateToTrip: () => void) => void;
}

export const useTicketNavigation = (tripKey: string) => {
    const [isPlaneFlying, setIsPlaneFlying] = useState(false);

    const navigate = useNavigate();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!isPlaneFlying) return;
        const timer = setTimeout(() => navigate(ROUTES.PATH.TRIP.ROOT(tripKey)), PLANE_FLIGHT_MS);
        return () => clearTimeout(timer);
    }, [isPlaneFlying, tripKey, navigate]);

    const openTrip = ({ playExitEffect }: OpenTripOptions = {}) => {
        queryClient.prefetchQuery({
            queryKey: ['route', tripKey],
            queryFn: () => toResult(() => routeAPI.fetchTripRoute(tripKey)),
        });
        if (playExitEffect) {
            playExitEffect(() => navigate(ROUTES.PATH.TRIP.ROOT(tripKey)));
            return;
        }
        setIsPlaneFlying(true);
    };

    return { isPlaneFlying, openTrip };
};
