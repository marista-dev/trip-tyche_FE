import { getArrivalCode, getDepartureCode } from '@/domains/trip/destinations';
import { formatDot, formatDuration } from '@/domains/trip/tripDates';

interface TicketSource {
    tripTitle?: string;
    country?: string;
    startDate?: string;
    endDate?: string;
}

export interface TicketView {
    departure: string;
    arrival: string;
    startText: string;
    endText: string;
    /** "2025.03.05 — 2025.03.09", 하루면 한쪽만. 날짜가 없으면 빈 문자열 */
    dateLine: string;
    /** "당일치기" / "N박 N일" / "—" */
    duration: string;
    /** 커버 사진이 없을 때 쓰는 그라데이션. 같은 여행이면 미리보기와 발급 티켓이 같은 색이다. */
    fallbackBg: string;
}

const PLACEHOLDER = '—';

const seedHue = (seed: string) => (seed ? (seed.charCodeAt(0) + seed.charCodeAt(seed.length - 1)) % 360 : 210);

/**
 * 티켓 한 장을 그리는 데 필요한 표시값. 발급 티켓·미리보기·공유 화면·액션시트가 같은 규칙을 쓴다.
 * 작성 중(미확정) 여행은 completed:false로 넘기면 날짜·기간을 비우고 도착 코드를 'TYC'로 둔다.
 */
export const getTicketView = (trip: TicketSource, { completed = true } = {}): TicketView => {
    const { tripTitle = '', country = '', startDate = '', endDate = '' } = trip;
    const startText = completed ? formatDot(startDate) : '';
    const endText = completed ? formatDot(endDate) : '';
    const hue = seedHue(tripTitle || country);

    return {
        departure: getDepartureCode(country),
        arrival: completed ? getArrivalCode(country) : 'TYC',
        startText: startText || PLACEHOLDER,
        endText: endText || PLACEHOLDER,
        dateLine: !startText ? '' : endText && endText !== startText ? `${startText} — ${endText}` : startText,
        duration: (completed && formatDuration(startDate, endDate)) || PLACEHOLDER,
        fallbackBg: `linear-gradient(135deg, oklch(0.7 0.08 ${hue}) 0%, oklch(0.35 0.08 ${(hue + 40) % 360}) 100%)`,
    };
};
