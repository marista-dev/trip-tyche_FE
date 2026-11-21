import type { TripCover } from '@/domains/trip/types';

/** 목록의 표지 URL. 썸네일이 없는 옛 사진은 원본으로 대체하고, 처리된 사진이 없으면 undefined */
export const getTripCoverUrl = (trip: TripCover): string | undefined =>
    trip.coverThumbnailLink ?? trip.coverMediaLink ?? undefined;
