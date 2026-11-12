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

    /**
     * play: 비행기 대신 자체 효과를 쓰는 티켓(당일 패스). 효과가 끝나면 넘겨준 이동 함수를 부른다.
     * 어느 쪽이든 탭하는 순간 route 데이터를 백그라운드 프리페치한다.
     */
    const handleCardClick = ({ play }: { play?: (go: () => void) => void } = {}) => {
        queryClient.prefetchQuery({
            queryKey: ['route', tripKey],
            queryFn: () => toResult(() => routeAPI.fetchTripRoute(tripKey)),
        });
        if (play) {
            play(() => navigate(ROUTES.PATH.TRIP.ROOT(tripKey)));
            return;
        }
        setIsAnimating(true);
    };

    return {
        isAnimating,
        handleCardClick,
    };
};
