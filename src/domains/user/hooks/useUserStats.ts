import { useMemo } from 'react';

import { useQueries } from '@tanstack/react-query';

import { MediaFile } from '@/domains/media/types';
import { useTripTicketList } from '@/domains/trip/hooks/queries';
import { Trip } from '@/domains/trip/types';
import { aggregateUserStats, UserStats } from '@/domains/user/utils/stats';
import { mediaAPI } from '@/libs/apis';
import { Result } from '@/libs/apis/shared/types';
import { toResult } from '@/libs/apis/shared/utils';

const EMPTY_MEDIA: MediaFile[] = [];

type TripMediaResult = Result<{ startDate: string; endDate: string; mediaFiles: MediaFile[] }>;

/**
 * 설정(마이) 페이지 통계 집계 훅.
 *
 * 여행 목록을 받은 뒤 여행마다 media-files를 병렬(useQueries)로 조회해 클라이언트에서 집계한다.
 * queryKey는 사진 관리 영역(useTripImages/useTripPhotos)과 동일한 ['trip-images', tripKey]를 사용해
 * 캐시를 공유한다(select만 옵저버별로 다름).
 *
 * ⚠️ 여행 수만큼 요청이 발생하는 N+1 구조다. 추후 백엔드 `GET /v1/users/me/stats`로 교체 예정이며
 * (`docs/prd-user-stats-api.md`), 교체 시 이 훅 내부만 단일 쿼리로 바꾸면 반환 타입(UserStats)은 동일하게 유지된다.
 */
export const useUserStats = (): { stats: UserStats; isLoading: boolean; isError: boolean } => {
    const tripsQuery = useTripTicketList(true);
    const tripsResult = tripsQuery.data;
    const trips: Trip[] = tripsResult && tripsResult.success ? (tripsResult.data as Trip[]) : [];

    const tripKeys = trips.map((trip) => trip.tripKey).filter((key): key is string => Boolean(key));

    const mediaQueries = useQueries({
        queries: tripKeys.map((tripKey) => ({
            queryKey: ['trip-images', tripKey],
            queryFn: () => toResult(() => mediaAPI.getTripImages(tripKey)),
            select: (result: TripMediaResult): MediaFile[] => (result.success ? result.data.mediaFiles : EMPTY_MEDIA),
            staleTime: 5 * 60 * 1000,
        })),
    });

    const isLoading = tripsQuery.isLoading || mediaQueries.some((query) => query.isLoading);
    const isError = tripsQuery.isError || mediaQueries.some((query) => query.isError);

    // dataUpdatedAt로 시그니처를 만든다. 사진 수가 같아도 내용(위치/날짜)이 바뀌면 값이 갱신되므로
    // 동일 개수 교체 시 stale 집계가 남는 문제를 막는다.
    const depKey =
        `${tripsQuery.dataUpdatedAt}#` +
        tripKeys.map((key, index) => `${key}:${mediaQueries[index]?.dataUpdatedAt ?? 0}`).join('|');

    const stats = useMemo(() => {
        const mediaByKey = new Map<string, MediaFile[]>();
        tripKeys.forEach((key, index) => {
            mediaByKey.set(key, mediaQueries[index]?.data ?? EMPTY_MEDIA);
        });
        const mediaLists = trips.map((trip) =>
            trip.tripKey ? (mediaByKey.get(trip.tripKey) ?? EMPTY_MEDIA) : EMPTY_MEDIA,
        );
        return aggregateUserStats(trips, mediaLists);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [depKey]);

    return { stats, isLoading, isError };
};
