import { describe, expect, it } from 'vitest';

import { KOREA_VALUE } from '@/domains/trip/destinations';
import { getTicketView } from '@/domains/trip/ticketView';
import { formatTicketDate } from '@/domains/trip/tripDates';

const GANGNEUNG = `${KOREA_VALUE}/강릉`;

describe('티켓 날짜', () => {
    it('하루면 날짜 하나 + 요일 — "11.11 — 11.11"처럼 두 번 쓰지 않는다', () => {
        expect(formatTicketDate('2025-11-11', '2025-11-11')).toBe('2025.11.11 (화)');
    });

    it('여러 날이면 끝은 월.일만, 해가 바뀌면 끝에도 연도', () => {
        expect(formatTicketDate('2025-10-03', '2025-10-05')).toBe('2025.10.03 (금) — 10.05 (일)');
        expect(formatTicketDate('2025-12-30', '2026-01-02')).toBe('2025.12.30 (화) — 2026.01.02 (금)');
    });

    it('달력에 없는 날짜는 다음 달로 넘기지 않고 잘못된 값으로 본다', () => {
        expect(formatTicketDate('2025-13-45', '2025-13-45')).toBe('');
        expect(formatTicketDate('2025-02-30', '2025-03-01')).toBe('');
    });

    it('날짜가 없거나 잘못되면 빈 문자열', () => {
        expect(formatTicketDate('', '')).toBe('');
        expect(formatTicketDate('nope', '2025-01-01')).toBe('');
    });
});

describe('getTicketView', () => {
    it('국내 당일여행은 1-Day 패스 — 한글 경로와 영문 지명', () => {
        const view = getTicketView({
            tripTitle: '강릉 바다',
            country: GANGNEUNG,
            startDate: '2025-11-11',
            endDate: '2025-11-11',
        });
        expect(view.isDayTrip).toBe(true);
        expect(view.routeText).toBe('국내 · 강릉');
        expect(view.placeEn).toBe('GANGNEUNG');
        expect(view.dateLine).toBe('2025.11.11 (화)');
        expect(view.duration).toBe('당일여행');
    });

    it('해외 여러 날은 탑승권 — 공항 코드 경로', () => {
        const view = getTicketView({ country: '🇯🇵/일본/JAPAN', startDate: '2025-07-12', endDate: '2025-07-15' });
        expect(view.isDayTrip).toBe(false);
        expect(view.routeText).toBe('ICN → NRT');
        expect(view.duration).toBe('3박 4일');
    });

    it('작성 중이면 패스로 그리지 않고 도착을 TYC로 둔다', () => {
        const view = getTicketView(
            { country: GANGNEUNG, startDate: '2025-11-11', endDate: '2025-11-11' },
            { completed: false },
        );
        expect(view.isDayTrip).toBe(false);
        expect(view.to.label).toBe('TYC');
        expect(view.dateLine).toBe('');
    });
});
