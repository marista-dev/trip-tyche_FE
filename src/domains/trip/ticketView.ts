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
    routeText: string;
    placeEn: string;
    isDayTrip: boolean;
    startText: string;
    endText: string;
    dateLine: string;
    duration: string;
    fallbackBg: string;
}

const PLACEHOLDER = '—';
const DRAFT_ARRIVAL: RoutePoint = { label: 'TYC', isCode: true };
const DEFAULT_HUE = 210;

const hueFromSeed = (seed: string) =>
    seed ? (seed.charCodeAt(0) + seed.charCodeAt(seed.length - 1)) % 360 : DEFAULT_HUE;

const formatRouteText = (from: RoutePoint, to: RoutePoint) =>
    from.isCode ? `${from.label} → ${to.label}` : `${from.label} · ${to.label}`;

export const getTicketView = (trip: TicketSource, { completed: isCompleted = true } = {}): TicketView => {
    const { tripTitle = '', country = '', startDate = '', endDate = '' } = trip;
    const startText = isCompleted ? formatDot(startDate) : '';
    const endText = isCompleted ? formatDot(endDate) : '';
    const route = getRoute(country);
    const to = isCompleted ? route.to : DRAFT_ARRIVAL;
    const hue = hueFromSeed(tripTitle || country);

    return {
        from: route.from,
        to,
        routeText: formatRouteText(route.from, to),
        placeEn: getPlaceEn(country),
        isDayTrip: isCompleted && getTripDays(startDate, endDate) === 1,
        startText: startText || PLACEHOLDER,
        endText: endText || PLACEHOLDER,
        dateLine: isCompleted ? formatTicketDate(startDate, endDate) : '',
        duration: (isCompleted && formatDuration(startDate, endDate)) || PLACEHOLDER,
        fallbackBg: `linear-gradient(135deg, oklch(0.7 0.08 ${hue}) 0%, oklch(0.35 0.08 ${(hue + 40) % 360}) 100%)`,
    };
};
