import { describe, expect, it } from 'vitest';

import { getDayLabels } from '@/domains/trip/dayLabels';

const DATES = ['2025-10-03', '2025-10-04', '2025-10-06'];
const labelsOf = (isDomestic: boolean) => getDayLabels(DATES, { isDomestic }).map((day) => day.label);

describe('날짜별 보기 날짜 이름', () => {
    it('해외는 출국 · Day N · 귀국', () => {
        expect(labelsOf(false)).toEqual(['출국', 'Day 2', '귀국']);
    });

    it('국내는 Day 1 · Day N · 마지막 날 — 출국·귀국이라 하지 않는다', () => {
        expect(labelsOf(true)).toEqual(['Day 1', 'Day 2', '마지막 날']);
    });

    it('사진이 없는 날을 건너뛰어도 Day 번호는 실제 날짜 차이를 따른다', () => {
        expect(getDayLabels(['2025-10-03', '2025-10-05', '2025-10-08'], { isDomestic: true })[1].label).toBe('Day 3');
    });

    it('하루뿐이면 당일', () => {
        expect(getDayLabels(['2024-03-30']).map((day) => day.label)).toEqual(['당일']);
    });
});
