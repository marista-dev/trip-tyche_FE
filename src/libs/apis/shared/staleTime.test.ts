import { describe, expect, it } from 'vitest';

import { QUERY_STALE_TIME, staleOnlyOnSuccess } from '@/libs/apis/shared/staleTime';

describe('staleOnlyOnSuccess', () => {
    it('성공 결과는 기본 staleTime만큼 fresh로 본다', () => {
        expect(staleOnlyOnSuccess({ state: { data: { success: true } } })).toBe(QUERY_STALE_TIME);
    });

    it('실패 결과와 아직 데이터가 없는 상태는 바로 낡은 것으로 본다', () => {
        expect(staleOnlyOnSuccess({ state: { data: { success: false } } })).toBe(0);
        expect(staleOnlyOnSuccess({ state: {} })).toBe(0);
    });
});
