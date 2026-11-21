import { useQuery } from '@tanstack/react-query';

import { userKeys } from '@/domains/user/queryKeys';
import { UserStats } from '@/domains/user/types';
import { userAPI } from '@/libs/apis';
import { staleOnlyOnSuccess } from '@/libs/apis/shared/staleTime';
import { toResult } from '@/libs/apis/shared/utils';

/** 응답 전·실패 때 보여줄 빈 통계. 매 렌더 새 객체가 되지 않도록 모듈 상수로 둔다 */
const EMPTY_USER_STATS: UserStats = {
    tripsCount: 0,
    totalPhotos: 0,
    locatedPhotos: 0,
    unlocatedPhotos: 0,
    countriesCount: 0,
    mostPhotographedDay: null,
    byTrip: [],
    byCountry: [],
};

/**
 * 설정(마이) 페이지 통계 훅. 집계는 서버(`GET /v1/users/me/stats`)가 하고 요청은 1번이다.
 *
 * 여행·사진이 바뀌면 invalidateTripLists(invalidateTripMedia 포함)가 이 키를 낡게 만들므로
 * staleTime을 길게 둬도 값이 늦게 반영되지 않는다.
 */
export const useUserStats = (): { stats: UserStats; isLoading: boolean; isError: boolean } => {
    const { data: result, isLoading } = useQuery({
        queryKey: userKeys.stats,
        queryFn: () => toResult(() => userAPI.fetchUserStats()),
        staleTime: staleOnlyOnSuccess,
    });

    return {
        stats: result?.success ? result.data : EMPTY_USER_STATS,
        isLoading,
        // 이 저장소의 쿼리는 toResult가 실패를 던지지 않고 Result로 돌려주므로(isError는 항상 false) 거기서 실패를 읽는다
        isError: result?.success === false,
    };
};
