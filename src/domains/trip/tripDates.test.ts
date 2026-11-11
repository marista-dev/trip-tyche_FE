import { describe, expect, it } from 'vitest';

import {
    formatDuration,
    getDateBounds,
    getDatesOutside,
    toDateString,
    toLocalDate,
    toPhotoDays,
} from '@/domains/trip/tripDates';
import { validateFormComplete } from '@/libs/utils/validate';

describe('tripDates', () => {
    it('날짜 문자열을 로컬 자정으로 해석한다 (UTC로 하루 밀리지 않는다)', () => {
        const d = toLocalDate('2025-03-05')!;
        expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours()]).toEqual([2025, 3, 5, 0]);
        expect(toDateString(d)).toBe('2025-03-05');
        expect(toLocalDate('2025-03-05T23:59:00')?.getDate()).toBe(5);
        expect(toLocalDate('')).toBeNull();
        expect(toLocalDate('잘못된값')).toBeNull();
    });

    it('날짜 없는 사진(1980-01-01)은 실제 촬영일로 치지 않는다', () => {
        expect(toPhotoDays(['1980-01-01', '2025-03-05T10:00:00', ''])).toEqual(['2025-03-05']);
    });

    it('사진 날짜 범위를 구한다', () => {
        expect(getDateBounds(['2025-03-09', '2025-03-05', '2025-03-07'])).toEqual({
            start: '2025-03-05',
            end: '2025-03-09',
        });
        expect(getDateBounds(['1980-01-01'])).toBeNull();
    });

    it('기간 밖 날짜를 중복 없이 정렬해 돌려준다', () => {
        const dates = ['2025-03-11', '2025-03-04', '2025-03-06', '2025-03-11T09:00:00'];
        expect(getDatesOutside(dates, '2025-03-05', '2025-03-09')).toEqual(['2025-03-04', '2025-03-11']);
        expect(getDatesOutside(dates, '', '')).toEqual([]);
    });

    it('기간을 당일치기 / N박 N일로 표기한다', () => {
        expect(formatDuration('2025-03-05', '2025-03-05')).toBe('당일치기');
        expect(formatDuration('2025-03-05', '2025-03-09')).toBe('4박 5일');
        expect(formatDuration('2025-03-09', '2025-03-05')).toBeNull();
        expect(formatDuration('', '')).toBeNull();
    });
});

describe('validateFormComplete', () => {
    const base = {
        tripTitle: '도쿄',
        country: '🇯🇵/일본/JAPAN',
        startDate: '2025-03-05',
        endDate: '2025-03-05',
        hashtags: ['벚꽃'],
    };

    it('필수값이 모두 있으면 완료 — 당일치기 포함', () => {
        expect(validateFormComplete(base)).toBe(true);
    });

    it('서버 응답의 confirmed:false 같은 부가 값은 무시한다', () => {
        expect(validateFormComplete({ ...base, confirmed: false, shareId: undefined })).toBe(true);
    });

    it.each([
        ['제목', { tripTitle: '  ' }],
        ['나라', { country: '' }],
        ['시작일', { startDate: '' }],
        ['종료일', { endDate: '' }],
        ['해시태그', { hashtags: [] }],
        ['뒤집힌 기간', { startDate: '2025-03-09', endDate: '2025-03-05' }],
    ])('%s이(가) 비거나 잘못되면 미완료', (_, patch) => {
        expect(validateFormComplete({ ...base, ...patch })).toBe(false);
    });
});

describe('표기', () => {
    it('점 표기와 기간 표기', async () => {
        const { formatDot, formatPeriod, getTripDays } = await import('@/domains/trip/tripDates');
        expect(formatDot('2025-03-05')).toBe('2025.03.05');
        expect(formatDot('')).toBe('');
        expect(formatPeriod('2025-03-05', '2025-03-09')).toBe('3월 5일–9일');
        // 달이 바뀌면 끝 날짜에도 월을 붙인다 (예전 사진 관리 헤더는 "3월 30일–2일"로 표시했다)
        expect(formatPeriod('2025-03-30', '2025-04-02')).toBe('3월 30일–4월 2일');
        expect(formatPeriod('2025-03-05', '2025-03-05')).toBe('3월 5일');
        expect(getTripDays('2025-03-30', '2025-04-02')).toBe(4);
        expect(getTripDays('2025-03-09', '2025-03-05')).toBe(0);
    });
});
