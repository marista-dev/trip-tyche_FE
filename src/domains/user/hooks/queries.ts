import { useQuery } from '@tanstack/react-query';

import { SUMMARY_QUERY_KEY } from '@/domains/user/queryKeys';
import { userAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';

/**
 * 사용자 summary 조회. AuthProvider가 부팅 때 받은 값을 이 키에 넣어 두고,
 * 페이지(MainPage / GlobeMapPage)는 socket invalidation 후 자동 refetch를 받기 위해 구독한다.
 * 인증 가드는 RequireAuth가 책임지므로 별도 enabled 옵션은 두지 않는다.
 *
 * staleTime 30초: 예전에는 0이라 부팅 직후 지구본 → 티켓 목록으로 가는 동안 같은 요청이 3번 나갔다.
 * 값이 바뀌는 경로(알림 읽음, 닉네임 변경, socket 알림)는 모두 invalidateQueries로 다시 받으므로 늦게 반영되지 않는다.
 */
export const useSummary = () =>
    useQuery({
        queryKey: SUMMARY_QUERY_KEY,
        queryFn: () => toResult(() => userAPI.fetchUserInfo()),
        staleTime: 30_000,
    });
