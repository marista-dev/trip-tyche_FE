import { useQueries } from '@tanstack/react-query';

import { MediaFile } from '@/domains/media/types';
import { mediaAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';

export interface TicketRingCovers {
    /** 첫 사진 URL. 사진이 없거나 아직 모르면 undefined */
    coverUrls: (string | undefined)[];
    /** 사진 수. 아직 모르면 null */
    photoCounts: (number | null)[];
}

const EMPTY: TicketRingCovers = { coverUrls: [], photoCounts: [] };

const fetchImages = (tripKey: string) => toResult(() => mediaAPI.getTripImages(tripKey));

/* select·combine은 모듈 수준에 둔다 — 렌더마다 새 함수를 넘기면 react-query가 매번 다시 계산해
   새 배열을 돌려주고, 이를 의존하는 링 갱신 effect도 렌더마다 돈다 */
const selectMediaFiles = (result: Awaited<ReturnType<typeof fetchImages>>): MediaFile[] | null =>
    result.success ? result.data.mediaFiles : null;

const combineCovers = (results: { data?: MediaFile[] | null }[]): TicketRingCovers =>
    results.length === 0
        ? EMPTY
        : {
              coverUrls: results.map((r) => r.data?.[0]?.mediaLink),
              photoCounts: results.map((r) => (r.data ? r.data.length : null)),
          };

/**
 * 링에 올린 여행들의 커버 사진·사진 수.
 * TripSummary에 커버가 없어 여행마다 media-files를 조회한다. 'trip-images' 키를 TripTicket·useUserStats와
 * 공유하므로 이미 본 여행은 캐시에서 바로 나온다.
 * TODO(backend): trip summary에 coverMediaLink·photoCount가 생기면 이 훅을 제거한다.
 */
export const useTicketRingCovers = (tripKeys: string[]): TicketRingCovers =>
    useQueries({
        queries: tripKeys.map((tripKey) => ({
            queryKey: ['trip-images', tripKey],
            queryFn: () => fetchImages(tripKey),
            select: selectMediaFiles,
            staleTime: 5 * 60 * 1000,
        })),
        combine: combineCovers,
    });
