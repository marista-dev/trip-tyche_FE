import { describe, expect, it } from 'vitest';

import { activeIndexOf, getRingLayout, mod, nearestTurnTo, snapTurn } from './ringLayout';

describe('getRingLayout', () => {
    it('1장이면 링 없이 정면에 둔다', () => {
        expect(getRingLayout(1).radius).toBe(0);
    });

    it('2장은 고정 반지름으로 앞뒤에 둔다', () => {
        expect(getRingLayout(2).radius).toBe(0.34);
    });

    it('장수가 늘면 반지름이 커지고, 7장부터 카드를 줄인다', () => {
        const five = getRingLayout(5);
        const nine = getRingLayout(9);
        expect(nine.radius).toBeGreaterThan(five.radius);
        expect(five.cardWidth).toBe(0.54);
        expect(nine.cardWidth).toBe(0.48);
    });

    it('카드끼리 겹치지 않을 만큼 둘레를 확보한다', () => {
        for (const n of [3, 4, 5, 6, 7, 9, 12]) {
            const { radius, step, cardWidth } = getRingLayout(n);
            const chord = 2 * radius * Math.sin(step / 2);
            expect(chord).toBeGreaterThanOrEqual(cardWidth * 0.98);
        }
    });
});

describe('activeIndexOf', () => {
    const { step } = getRingLayout(5);

    it('회전값을 가장 가까운 카드 인덱스로 바꾼다', () => {
        expect(activeIndexOf(0, step, 5)).toBe(0);
        expect(activeIndexOf(step * 2.4, step, 5)).toBe(2);
    });

    it('음수 회전과 한 바퀴 이상도 0..n-1로 접는다', () => {
        expect(activeIndexOf(-step, step, 5)).toBe(4);
        expect(activeIndexOf(step * 7, step, 5)).toBe(2);
    });
});

describe('nearestTurnTo', () => {
    it('가까운 방향으로 돈다', () => {
        expect(nearestTurnTo(0, 4, 5)).toBe(-1);
        expect(nearestTurnTo(0, 1, 5)).toBe(1);
        expect(nearestTurnTo(6, 0, 5)).toBe(5);
    });

    it('결과 칸은 항상 해당 인덱스를 정면에 둔다', () => {
        for (let cur = -7; cur <= 7; cur++) {
            for (let i = 0; i < 5; i++) expect(mod(nearestTurnTo(cur, i, 5), 5)).toBe(i);
        }
    });
});

describe('snapTurn', () => {
    it('관성 방향으로 한 칸 더 넘어간다', () => {
        const step = 1;
        expect(snapTurn(0.3, 0, step)).toBe(0);
        expect(snapTurn(0.3, -0.004, step)).toBe(1);
    });
});

describe('mod', () => {
    it('음수도 양수 나머지로 바꾼다', () => {
        expect(mod(-1, 5)).toBe(4);
    });
});
