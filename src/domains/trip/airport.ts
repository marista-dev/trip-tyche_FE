import { getArrivalCode } from '@/domains/trip/destinations';

/**
 * 티켓 도착 코드. 국내 여행은 지역 코드(CJU 등), 해외는 나라 대표 공항.
 * 실제 규칙은 destinations.ts에 있다 — 기존 호출부 호환용 이름.
 */
export const getIataFromCountryString = (country?: string): string => getArrivalCode(country);
