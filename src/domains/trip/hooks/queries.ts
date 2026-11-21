import { useQuery } from '@tanstack/react-query';

import { tripKeys } from '@/domains/trip/queryKeys';
import { TripSummary } from '@/domains/trip/types';
import { tripAPI } from '@/libs/apis';
import { QUERY_STALE_TIME } from '@/libs/apis/shared/staleTime';
import { toResult } from '@/libs/apis/shared/utils';

// 여행 티켓 목록 조회
export const useTripTicketList = (isEnable: boolean) => {
    return useQuery({
        queryKey: tripKeys.ticketList,
        queryFn: () => toResult(() => tripAPI.fetchTripTicketList()),
        select: (result) => {
            return result.success
                ? {
                      ...result,
                      data: result.data.trips,
                  }
                : result;
        },
        enabled: isEnable,
        staleTime: 0,
    });
};

// 지구본 전용 — 경량 5개 필드, GUEST 트리거 없음
export const useTripSummaryList = (isEnable: boolean) => {
    return useQuery({
        queryKey: tripKeys.summaryList,
        queryFn: () => toResult(() => tripAPI.fetchTripSummaryList()),
        select: (result) => {
            return result.success ? { ...result, data: result.data.trips as TripSummary[] } : result;
        },
        enabled: isEnable,
        staleTime: QUERY_STALE_TIME,
    });
};

// 특정 여행 정보 조회
export const useTripInfo = (tripKey: string) => {
    return useQuery({
        queryKey: tripKeys.info(tripKey),
        queryFn: () => toResult(() => tripAPI.fetchTripTicketInfo(tripKey)),
    });
};
