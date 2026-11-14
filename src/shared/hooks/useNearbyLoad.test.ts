import { describe, expect, it } from 'vitest';

import { clampIndex, markNearby, photoListKey } from './useNearbyLoad';

describe('markNearby', () => {
    it('현재 위치 ±2장을 기록한다', () => {
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

    it('기존 기록을 바꾸지 않는다(버려진 렌더가 남지 않게)', () => {
        const first = markNearby(null, 0, 'a', 2);
        markNearby(first, 20, 'a', 2);
        expect(first.indices.has(20)).toBe(false);
    });
});

describe('clampIndex', () => {
    it('목록이 줄어 범위를 벗어난 위치는 마지막 사진으로 자른다', () => {
        expect(clampIndex(12, 5)).toBe(4);
        expect(clampIndex(-1, 5)).toBe(0);
        expect(clampIndex(3, 0)).toBe(0);
    });
});

describe('photoListKey', () => {
    it('길이나 첫 사진이 바뀌면 키가 바뀐다', () => {
        expect(photoListKey([{ mediaFileId: 1 }, { mediaFileId: 2 }])).not.toBe(photoListKey([{ mediaFileId: 3 }]));
        expect(photoListKey([])).toBe('0:');
    });
});
