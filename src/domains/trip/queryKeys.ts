import type { QueryClient } from '@tanstack/react-query';

import { userKeys } from '@/domains/user/queryKeys';

/** 여행 쿼리 키. 값은 그대로 두고 문자열이 흩어지지 않게 한 곳에 모은다 */
export const tripKeys = {
    ticketList: ['ticket-list'] as const,
    // 지구본 전용 경량 목록
    summaryList: ['trip-summary-list'] as const,
    infoAll: ['ticket-info'] as const,
    info: (tripKey: string) => ['ticket-info', tripKey] as const,
};

/**
 * 티켓 목록과 지구본 목록은 같은 여행을 담으므로 항상 함께 갱신한다.
 * 마이 페이지 통계도 같은 여행 집합(공유 수락·삭제 포함)에서 집계되므로 여기서 같이 낡게 한다.
 * invalidateTripMedia가 이 함수를 부르므로 사진 변경도 통계 갱신까지 이어진다.
 */
export const invalidateTripLists = (queryClient: QueryClient) =>
    Promise.all([
        queryClient.invalidateQueries({ queryKey: tripKeys.ticketList }),
        queryClient.invalidateQueries({ queryKey: tripKeys.summaryList }),
        queryClient.invalidateQueries({ queryKey: userKeys.stats }),
    ]);
