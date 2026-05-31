import { useEffect, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { routeAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';
import { ROUTES } from '@/shared/constants/route';

export const useTicketNavigation = (tripKey: string) => {
    const [isAnimating, setIsAnimating] = useState(false);

    const navigate = useNavigate();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (isAnimating) {
            const timer = setTimeout(() => {
                navigate(`${ROUTES.PATH.TRIP.ROOT(tripKey)}`);
            }, 1050);

            return () => clearTimeout(timer);
        }
    }, [isAnimating, tripKey, navigate]);

    const handleCardClick = () => {
        setIsAnimating(true);
        // 애니메이션 800ms 동안 route 데이터 백그라운드 프리페치
        queryClient.prefetchQuery({
            queryKey: ['route', tripKey],
            queryFn: () => toResult(() => routeAPI.fetchTripRoute(tripKey)),
        });
    };

    return {
        isAnimating,
        handleCardClick,
    };
};
