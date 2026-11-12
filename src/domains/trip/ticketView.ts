import { getPlaceEn, getRoute, RoutePoint } from '@/domains/trip/destinations';
import { formatDot, formatDuration, formatTicketDate, getTripDays } from '@/domains/trip/tripDates';

interface TicketSource {
    tripTitle?: string;
    country?: string;
    startDate?: string;
    endDate?: string;
}

export interface TicketView {
    from: RoutePoint;
    to: RoutePoint;
    /** 한 줄 경로. "국내 · 강릉" / "ICN → NRT" */
    routeText: string;
    /** 영문 지명. 당일 패스 옆면에 쓴다 */
    placeEn: string;
    /** 하루짜리 여행 — 탑승권 대신 1-Day 패스로 그린다 */
    isDayTrip: boolean;
    startText: string;
    endText: string;
    /** "2025.11.11 (화)" / "2025.10.03 (금) — 10.05 (일)". 날짜가 없으면 빈 문자열 */
    dateLine: string;
    /** "당일여행" / "N박 N일" / "—" */
    duration: string;
    /** 커버 사진이 없을 때의 그라데이션(같은 여행이면 같은 색) */
    fallbackBg: string;
}

const PLACEHOLDER = '—';
const DRAFT_ARRIVAL: RoutePoint = { label: 'TYC', isCode: true };

const seedHue = (seed: string) => (seed ? (seed.charCodeAt(0) + seed.charCodeAt(seed.length - 1)) % 360 : 210);

/** completed:false(작성 중)면 날짜·기간을 비우고 도착을 'TYC'로 둔다. */
export const getTicketView = (trip: TicketSource, { completed = true } = {}): TicketView => {
    const { tripTitle = '', country = '', startDate = '', endDate = '' } = trip;
    const startText = completed ? formatDot(startDate) : '';
    const endText = completed ? formatDot(endDate) : '';
    const route = getRoute(country);
    const to = completed ? route.to : DRAFT_ARRIVAL;
    const hue = seedHue(tripTitle || country);

    return {
        from: route.from,
        to,
        routeText: route.from.isCode ? `${route.from.label} → ${to.label}` : `${route.from.label} · ${to.label}`,
        placeEn: getPlaceEn(country),
        isDayTrip: completed && getTripDays(startDate, endDate) === 1,
        startText: startText || PLACEHOLDER,
        endText: endText || PLACEHOLDER,
        dateLine: completed ? formatTicketDate(startDate, endDate) : '',
        duration: (completed && formatDuration(startDate, endDate)) || PLACEHOLDER,
        fallbackBg: `linear-gradient(135deg, oklch(0.7 0.08 ${hue}) 0%, oklch(0.35 0.08 ${(hue + 40) % 360}) 100%)`,
    };
};
