import { describe, it, expect } from 'vitest';

import { translateFailureReason } from './translateFailureReason';

describe('translateFailureReason', () => {
    it('returns fallback message for null', () => {
        expect(translateFailureReason(null)).toBe('알 수 없는 오류가 발생했습니다');
    });

    it('returns fallback message for undefined', () => {
        expect(translateFailureReason(undefined)).toBe('알 수 없는 오류가 발생했습니다');
    });

    it('returns fallback message for empty string', () => {
        expect(translateFailureReason('')).toBe('알 수 없는 오류가 발생했습니다');
    });

    it('returns corrupted message when reason includes "corrupted"', () => {
        expect(translateFailureReason('corrupted file')).toBe('손상된 이미지입니다');
    });

    it('returns format message when reason includes "format"', () => {
        expect(translateFailureReason('unsupported format')).toBe('지원하지 않는 형식입니다');
    });

    it('returns size message when reason includes "size"', () => {
        expect(translateFailureReason('file size too large')).toBe('이미지가 너무 큽니다');
    });

    it('returns generic error message for unrecognized reason', () => {
        expect(translateFailureReason('network timeout')).toBe('처리 중 오류가 발생했습니다');
    });
});
