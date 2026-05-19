import { useQuery } from '@tanstack/react-query';

import { MediaFile } from '@/domains/media/types';
import { mediaAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';

/**
 * 사진 관리 영역 페이지들이 쓰는 단순화된 hook — 페이지마다 반복되던
 * `imagesResult?.success ? imagesResult.data as MediaFile[] : []` 패턴을 select 안으로 흡수.
 *
 * 성공 시 MediaFile[], 실패/로딩 시 빈 배열을 반환한다. isLoading은 그대로 노출.
 * 에러 분기가 필요한 곳(TripTicket, GlobeMapPage 등)은 기존 useTripImages를 유지.
 */
// 모듈-레벨 빈 배열 상수 — 매 렌더마다 새 [] 반환 시 downstream useMemo 의존성이 매번 깨지는 것을 방지
const EMPTY_PHOTOS: MediaFile[] = [];

export const useTripPhotos = (tripKey: string) => {
    const query = useQuery({
        queryKey: ['trip-images', tripKey],
        queryFn: () => toResult(() => mediaAPI.getTripImages(tripKey)),
        select: (result): MediaFile[] => (result.success ? result.data.mediaFiles : EMPTY_PHOTOS),
    });
    return {
        photos: query.data ?? EMPTY_PHOTOS,
        isLoading: query.isLoading,
    };
};

export const useTripImages = (tripKey: string) => {
    return useQuery({
        queryKey: ['trip-images', tripKey],
        queryFn: () => toResult(() => mediaAPI.getTripImages(tripKey)),
        select: (result) => {
            return result.success
                ? {
                      ...result,
                      data: result.data.mediaFiles,
                  }
                : result;
        },
    });
};

export const useMediaByPinPoint = (tripKey: string, pinPointId: string) =>
    useQuery({
        queryKey: ['media', 'by-pinPoint', tripKey, pinPointId],
        queryFn: () => toResult(() => mediaAPI.fetchMediaByPinPoint(tripKey, pinPointId)),
        select: (result) => {
            return result.success
                ? {
                      ...result,
                      data: result.data.mediaFiles,
                  }
                : result;
        },
    });

export const useMediaByDate = (tripKey: string, date: string) => {
    if (!tripKey || !date) {
        console.error('tripKey와 date은 필수값입니다.');
    }

    return useQuery({
        queryKey: ['media', 'by-date', tripKey, date],
        queryFn: () => toResult(() => mediaAPI.fetchMediaByDate(tripKey, date)),
        select: (result) => {
            return result.success
                ? {
                      ...result,
                      data: result.data.mediaFiles,
                  }
                : result;
        },
        enabled: Boolean(tripKey && date),
    });
};
