import { describe, it, expect } from 'vitest';

import { selectDisplayUrl } from './selectDisplayUrl';
import type { MediaFileItem } from '@/domains/media/types';

function makeItem(status: MediaFileItem['status']): MediaFileItem {
    return {
        mediaFileId: 1,
        currentUrl: 'current.jpg',
        finalUrl: 'final.jpg',
        status,
    };
}

describe('selectDisplayUrl', () => {
    it('returns currentUrl for LEGACY', () => {
        expect(selectDisplayUrl(makeItem('LEGACY'))).toBe('current.jpg');
    });

    it('returns finalUrl for PROCESSED', () => {
        expect(selectDisplayUrl(makeItem('PROCESSED'))).toBe('final.jpg');
    });

    it('returns currentUrl for UPLOADED', () => {
        expect(selectDisplayUrl(makeItem('UPLOADED'))).toBe('current.jpg');
    });

    it('returns currentUrl for PROCESSING', () => {
        expect(selectDisplayUrl(makeItem('PROCESSING'))).toBe('current.jpg');
    });

    it('returns currentUrl for FAILED', () => {
        expect(selectDisplayUrl(makeItem('FAILED'))).toBe('current.jpg');
    });
});
