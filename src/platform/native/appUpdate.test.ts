import { describe, it, expect } from 'vitest';

import { __compareVersions as compareVersions } from './appUpdate';

describe('compareVersions', () => {
    it('같은 버전은 0', () => {
        expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('낮은 버전은 음수', () => {
        expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
        expect(compareVersions('1.0.0', '1.1.0')).toBeLessThan(0);
        expect(compareVersions('1.9.0', '2.0.0')).toBeLessThan(0);
    });

    it('높은 버전은 양수', () => {
        expect(compareVersions('1.2.0', '1.1.9')).toBeGreaterThan(0);
    });

    it('자리수가 달라도 비교된다 (1.0 == 1.0.0)', () => {
        expect(compareVersions('1.0', '1.0.0')).toBe(0);
        expect(compareVersions('1.0', '1.0.1')).toBeLessThan(0);
    });

    it('10 이상 숫자를 문자열이 아닌 수로 비교한다', () => {
        // 문자열 비교였다면 "9" > "10"으로 잘못 판정된다
        expect(compareVersions('1.9.0', '1.10.0')).toBeLessThan(0);
    });

    it('잘못된 형식은 0으로 취급해 앱을 막지 않는다', () => {
        expect(compareVersions('1.0.0', 'abc')).toBeGreaterThan(0);
    });
});
