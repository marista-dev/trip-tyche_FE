/**
 * 여행 목록(티켓·지구본) 응답이 함께 주는 표지와 사진 수.
 * 이 필드가 생기기 전 응답에는 없으므로 모두 선택값이다.
 */
export interface TripCover {
    /** 표지 사진 원본(긴 변 1920px). 처리가 끝난 사진이 없으면 null */
    coverMediaLink?: string | null;
    /** 여행의 사진 수. 처리 중인 사진도 센다 */
    photoCount?: number;
    /** 표지 축소본(짧은 변 800px). 썸네일 도입 전에 처리된 사진은 null이라 coverMediaLink로 대체한다 */
    coverThumbnailLink?: string | null;
}

export interface Trip extends TripInfo, TripCover {
    ownerNickname?: string;
    sharedUsersNicknames?: string[];
}

export interface TripInfo {
    tripKey?: string;
    tripTitle: string;
    country: string;
    startDate: string;
    endDate: string;
    hashtags: string[];
    mediaFilesDates?: string[];
    shareId?: number;
    confirmed?: boolean;
}

export interface TripSummary extends TripCover {
    tripKey: string;
    tripTitle: string;
    country: string;
    startDate: string;
    endDate: string;
}

export interface Country {
    emoji: string;
    nameKo: string;
    nameEn: string;
    value: string;
    iata: string;
}
