import { DEFAULT_METADATA } from '@/domains/media/constants';
import { MediaFile } from '@/domains/media/types';
import { Trip } from '@/domains/trip/types';
import { hasValidLocation } from '@/libs/utils/validate';

/**
 * 설정(마이) 페이지 통계 집계용 순수 함수 모음.
 *
 * 현재는 프론트에서 여행 목록 + 여행별 media를 받아 클라이언트에서 집계한다.
 * 추후 백엔드 `GET /v1/users/me/stats`로 교체될 예정이며(`docs/prd-user-stats-api.md`),
 * 그 때는 useUserStats 내부만 단일 쿼리로 바꾸고 아래 타입을 그대로 재사용한다.
 */

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

/** 날짜 정보 없음을 의미하는 기본값(1980-01-01) */
const DATE_NONE = DEFAULT_METADATA.DATE.split('T')[0];

/** "🇯🇵/일본/JAPAN" → { emoji, name } (SharedTicket의 country.split('/') 패턴과 동일) */
export const splitCountry = (country: string): { emoji: string; name: string } => {
    const value = country ?? '';
    // "emoji/ko/en" 포맷이 아닌(구분자 없는) 값이면 이모지 자리에 본문이 새지 않도록 방어한다.
    if (!value.includes('/')) return { emoji: '', name: value };
    const parts = value.split('/');
    return { emoji: parts[0] ?? '', name: parts[1] || value };
};

/** 집계에서 제외할 빈/플레이스홀더 국가 (예: "👋/트립티케/TRIP TYCHE") */
const isPlaceholderCountry = (country: string): boolean =>
    !country || country.includes('트립티케') || country.includes('TRIP TYCHE');

/**
 * 여행 목록과 각 여행에 정렬-대응되는 media 리스트로 사용자 통계를 집계한다.
 * @param trips 여행 목록
 * @param mediaLists trips와 같은 순서의 여행별 MediaFile 배열
 */
export const aggregateUserStats = (trips: Trip[], mediaLists: MediaFile[][]): UserStats => {
    const byTrip: TripStat[] = [];
    const countryMap = new Map<string, CountryStat>();
    const dayCount = new Map<string, number>();
    const dayLabel = new Map<string, string>();

    let totalPhotos = 0;
    let locatedPhotos = 0;

    trips.forEach((trip, index) => {
        const media = mediaLists[index] ?? [];
        const photoCount = media.length;
        totalPhotos += photoCount;
        locatedPhotos += media.filter((file) => hasValidLocation(file)).length;

        if (trip.tripKey) {
            byTrip.push({
                tripKey: trip.tripKey,
                tripTitle: trip.tripTitle,
                startDate: trip.startDate,
                endDate: trip.endDate,
                photoCount,
            });
        }

        if (!isPlaceholderCountry(trip.country)) {
            const existing = countryMap.get(trip.country);
            if (existing) {
                existing.visits += 1;
                existing.photoCount += photoCount;
            } else {
                const { emoji, name } = splitCountry(trip.country);
                countryMap.set(trip.country, { country: trip.country, emoji, name, visits: 1, photoCount });
            }
        }

        media.forEach((file) => {
            const day = (file.recordDate ?? '').split('T')[0];
            if (!day || day === DATE_NONE) return;
            dayCount.set(day, (dayCount.get(day) ?? 0) + 1);
            if (!dayLabel.has(day)) {
                const { name } = splitCountry(trip.country);
                dayLabel.set(day, name || trip.tripTitle);
            }
        });
    });

    byTrip.sort((a, b) => b.photoCount - a.photoCount);
    const byCountry = Array.from(countryMap.values()).sort((a, b) => b.photoCount - a.photoCount);

    let mostPhotographedDay: MostPhotographedDay | null = null;
    dayCount.forEach((count, date) => {
        if (!mostPhotographedDay || count > mostPhotographedDay.count) {
            mostPhotographedDay = { date, count, label: dayLabel.get(date) ?? '' };
        }
    });

    return {
        tripsCount: trips.length,
        totalPhotos,
        locatedPhotos,
        unlocatedPhotos: totalPhotos - locatedPhotos,
        countriesCount: countryMap.size,
        mostPhotographedDay,
        byTrip,
        byCountry,
    };
};

/** 통계 로딩 중 표시할 빈 통계 */
export const EMPTY_USER_STATS: UserStats = {
    tripsCount: 0,
    totalPhotos: 0,
    locatedPhotos: 0,
    unlocatedPhotos: 0,
    countriesCount: 0,
    mostPhotographedDay: null,
    byTrip: [],
    byCountry: [],
};
