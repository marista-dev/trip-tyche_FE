export interface UserInfo {
    userId: number;
    nickname: string;
    tripsCount: number;
    unreadNotificationsCount: number;
    role: 'USER' | 'GUEST';
    // 가입 시각. KST 기준이지만 백엔드 LocalDateTime이라 오프셋 없이 내려온다(예: 2026-11-11T21:00:55.253692).
    // 시간대를 해석해야 할 때 이 점을 기억할 것.
    createdAt: string;
}

export interface TripStat {
    tripKey: string;
    tripTitle: string;
    startDate: string;
    endDate: string;
    photoCount: number;
}

export interface CountryStat {
    /** 원본 country 문자열 (예: "🇯🇵/일본/JAPAN") */
    country: string;
    emoji: string;
    name: string;
    visits: number;
    photoCount: number;
}

export interface MostPhotographedDay {
    /** YYYY-MM-DD */
    date: string;
    count: number;
    /** 부제 (국가명 또는 여행 제목) */
    label: string;
}

/** GET /v1/users/me/stats 응답. 백엔드 UserStatsResponse와 필드가 1:1로 맞는다 */
export interface UserStats {
    tripsCount: number;
    totalPhotos: number;
    locatedPhotos: number;
    unlocatedPhotos: number;
    countriesCount: number;
    mostPhotographedDay: MostPhotographedDay | null;
    byTrip: TripStat[];
    byCountry: CountryStat[];
}
