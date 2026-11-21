import type { QueryClient } from '@tanstack/react-query';

import { routeKeys } from '@/domains/route/queryKeys';
import { invalidateTripLists } from '@/domains/trip/queryKeys';

/** 사진 쿼리 키. 여행 키를 셋째 자리에 둬 핀·날짜를 몰라도 여행 단위 앞부분 일치로 지울 수 있다 */
export const mediaKeys = {
    tripImages: (tripKey: string) => ['trip-images', tripKey] as const,
    byPinPointOfTrip: (tripKey: string) => ['media', 'by-pinPoint', tripKey] as const,
    byPinPoint: (tripKey: string, pinPointId: string) => ['media', 'by-pinPoint', tripKey, pinPointId] as const,
    byDateOfTrip: (tripKey: string) => ['media', 'by-date', tripKey] as const,
    byDate: (tripKey: string, date: string) => ['media', 'by-date', tripKey, date] as const,
};

/** 사진이 바뀌면 그 여행의 사진·지도 핀과, 표지·장수를 담은 여행 목록이 함께 낡는다 */
export const invalidateTripMedia = (queryClient: QueryClient, tripKey: string) =>
    Promise.all([
        queryClient.invalidateQueries({ queryKey: mediaKeys.tripImages(tripKey) }),
        queryClient.invalidateQueries({ queryKey: routeKeys.detail(tripKey) }),
        queryClient.invalidateQueries({ queryKey: mediaKeys.byPinPointOfTrip(tripKey) }),
        queryClient.invalidateQueries({ queryKey: mediaKeys.byDateOfTrip(tripKey) }),
        invalidateTripLists(queryClient),
    ]);
