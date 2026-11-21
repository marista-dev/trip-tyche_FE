import { describe, expect, it } from 'vitest';

import { getTripCoverUrl } from './tripCover';

describe('getTripCoverUrl', () => {
    it('썸네일이 있으면 썸네일을 쓴다', () => {
        expect(getTripCoverUrl({ coverThumbnailLink: 'thumb.webp', coverMediaLink: 'full.webp' })).toBe('thumb.webp');
    });

    it('썸네일이 null이면 원본으로 대체한다', () => {
        expect(getTripCoverUrl({ coverThumbnailLink: null, coverMediaLink: 'full.webp' })).toBe('full.webp');
    });

    it('필드가 없는 옛 응답에서도 원본으로 대체한다', () => {
        expect(getTripCoverUrl({ coverMediaLink: 'full.webp' })).toBe('full.webp');
    });

    it('처리된 사진이 없으면 undefined', () => {
        expect(getTripCoverUrl({ coverMediaLink: null, coverThumbnailLink: null })).toBeUndefined();
        expect(getTripCoverUrl({})).toBeUndefined();
    });
});
