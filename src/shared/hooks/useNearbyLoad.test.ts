import { describe, expect, it } from 'vitest';

import { markNearby } from './useNearbyLoad';

describe('markNearby', () => {
    it('현재 위치 ±2장만 받는다', () => {
        const { indices } = markNearby(null, 5, 'a', 2);
        expect([2, 3, 4, 5, 6, 7, 8].map((i) => indices.has(i))).toEqual([false, true, true, true, true, true, false]);
    });

    it('한 번 받은 사진은 멀어져도 계속 둔다', () => {
        const { indices } = markNearby(markNearby(null, 0, 'a', 2), 10, 'a', 2);
        expect(indices.has(1)).toBe(true);
        expect(indices.has(10)).toBe(true);
        expect(indices.has(5)).toBe(false);
    });

    it('목록이 바뀌면 기록을 비운다', () => {
        const { indices } = markNearby(markNearby(null, 10, 'a', 2), 0, 'b', 2);
        expect(indices.has(10)).toBe(false);
        expect(indices.has(0)).toBe(true);
    });
});
