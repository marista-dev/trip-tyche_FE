import { describe, expect, it } from 'vitest';

import { findHourGroupAt, formatHour, getPhotoHour, groupByHour } from '@/domains/trip/photoTimes';

describe('사진 시간대', () => {
    it('촬영 시각에서 시를 읽는다 — ISO·공백 형식 모두', () => {
        expect(getPhotoHour('2024-03-30T13:45:00')).toBe(13);
        expect(getPhotoHour('2024-03-30 09:05:00')).toBe(9);
        expect(getPhotoHour('2024-03-30')).toBeNull();
        expect(getPhotoHour(undefined)).toBeNull();
    });

    it('오전/오후 12시간제로 표기한다', () => {
        expect(formatHour(0)).toBe('오전 12시');
        expect(formatHour(10)).toBe('오전 10시');
        expect(formatHour(12)).toBe('오후 12시');
        expect(formatHour(18)).toBe('오후 6시');
    });

    it('이어지는 같은 시끼리 묶고, 첫 사진 위치와 장수를 갖는다', () => {
        const groups = groupByHour([
            '2024-03-30T10:30:00',
            '2024-03-30T13:10:00',
            '2024-03-30T13:45:00',
            '2024-03-30T15:00:00',
            '2024-03-30T18:20:00',
        ]);
        expect(groups.map((g) => [g.title, g.startIndex, g.count])).toEqual([
            ['오전 10시', 0, 1],
            ['오후 1시', 1, 2],
            ['오후 3시', 3, 1],
            ['오후 6시', 4, 1],
        ]);
        expect(findHourGroupAt(groups, 2)?.title).toBe('오후 1시');
    });

    it('시각을 모르는 사진은 따로 묶고, 같은 시가 다시 나와도 키가 겹치지 않는다', () => {
        const groups = groupByHour(['2024-03-30T10:00:00', '2024-03-30', '2024-03-30T10:20:00']);
        expect(groups.map((g) => g.title)).toEqual(['오전 10시', '시간 없음', '오전 10시']);
        expect(new Set(groups.map((g) => g.key)).size).toBe(3);
    });
});
