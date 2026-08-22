import { describe, it, expect } from 'vitest';

import { extractDateFromExif, parseExifDateTime, readDateTimeTag } from './exif';
import type { Exif } from '@/shared/types/exif';

// EXIF 태그 번호 (piexifjs 상수와 동일)
const EXIF_IFD_DATE_TIME_ORIGINAL = 36867;
const EXIF_IFD_DATE_TIME_DIGITIZED = 36868;
const IMAGE_IFD_DATE_TIME = 306;

describe('readDateTimeTag', () => {
    it('DateTimeOriginal이 있으면 그 값을 쓴다', () => {
        const exifData: Exif = {
            Exif: {
                [EXIF_IFD_DATE_TIME_ORIGINAL]: '2023:04:01 12:34:56',
                [EXIF_IFD_DATE_TIME_DIGITIZED]: '2023:04:01 12:34:56',
            },
            '0th': {
                [IMAGE_IFD_DATE_TIME]: '2023:04:01 12:34:56',
            },
        };

        expect(readDateTimeTag(exifData)).toBe('2023:04:01 12:34:56');
    });

    it('DateTimeOriginal이 없고 DateTimeDigitized만 있으면 그것을 쓴다', () => {
        const exifData: Exif = {
            Exif: {
                [EXIF_IFD_DATE_TIME_DIGITIZED]: '2023:05:02 08:00:00',
            },
        };

        expect(readDateTimeTag(exifData)).toBe('2023:05:02 08:00:00');
    });

    it('Exif IFD가 통째로 없으면 0th.DateTime으로 폴백한다', () => {
        const exifData: Exif = {
            '0th': {
                [IMAGE_IFD_DATE_TIME]: '2023:06:03 09:10:11',
            },
        };

        expect(readDateTimeTag(exifData)).toBe('2023:06:03 09:10:11');
    });

    it('DateTimeOriginal과 0th.DateTime이 다를 때 전자를 택한다 (버그의 핵심 케이스)', () => {
        // 편집·재저장되거나 메신저를 거친 사진: 0th.DateTime은 재저장 시점(오늘)으로 덮어써지고,
        // Exif.DateTimeOriginal은 촬영 시점(작년)을 유지한다.
        const exifData: Exif = {
            Exif: {
                [EXIF_IFD_DATE_TIME_ORIGINAL]: '2022:08:15 10:00:00',
            },
            '0th': {
                [IMAGE_IFD_DATE_TIME]: '2026:08:22 18:30:00',
            },
        };

        expect(readDateTimeTag(exifData)).toBe('2022:08:15 10:00:00');
    });

    it('셋 다 없으면 undefined를 반환한다', () => {
        const exifData: Exif = {};

        expect(readDateTimeTag(exifData)).toBeUndefined();
    });
});

describe('parseExifDateTime', () => {
    it('정상적인 EXIF 날짜 문자열을 Date로 변환한다', () => {
        const date = parseExifDateTime('2023:04:01 12:34:56');

        expect(date).not.toBeNull();
        expect(date?.getFullYear()).toBe(2023);
        expect(date?.getMonth()).toBe(3); // 0-indexed => 4월
        expect(date?.getDate()).toBe(1);
        expect(date?.getHours()).toBe(12);
        expect(date?.getMinutes()).toBe(34);
        expect(date?.getSeconds()).toBe(56);
    });

    it('"0000:00:00 00:00:00" → null (이전에는 Invalid Date)', () => {
        expect(parseExifDateTime('0000:00:00 00:00:00')).toBeNull();
    });

    it('"2023:04:01" (시간 없음) → null', () => {
        expect(parseExifDateTime('2023:04:01')).toBeNull();
    });
});

describe('extractDateFromExif', () => {
    it('DateTimeOriginal이 있으면 그 값을 파싱해서 반환한다', () => {
        const exifData: Exif = {
            Exif: {
                [EXIF_IFD_DATE_TIME_ORIGINAL]: '2023:04:01 12:34:56',
            },
            '0th': {
                [IMAGE_IFD_DATE_TIME]: '2024:01:01 00:00:00',
            },
        };

        const date = extractDateFromExif(exifData);

        expect(date).not.toBeNull();
        expect(date?.getFullYear()).toBe(2023);
        expect(date?.getMonth()).toBe(3);
        expect(date?.getDate()).toBe(1);
    });

    it('DateTimeOriginal이 없고 DateTimeDigitized만 있으면 그것을 쓴다', () => {
        const exifData: Exif = {
            Exif: {
                [EXIF_IFD_DATE_TIME_DIGITIZED]: '2023:05:02 08:00:00',
            },
        };

        const date = extractDateFromExif(exifData);

        expect(date).not.toBeNull();
        expect(date?.getFullYear()).toBe(2023);
        expect(date?.getMonth()).toBe(4);
        expect(date?.getDate()).toBe(2);
    });

    it('Exif IFD가 통째로 없으면 0th.DateTime으로 폴백한다', () => {
        const exifData: Exif = {
            '0th': {
                [IMAGE_IFD_DATE_TIME]: '2023:06:03 09:10:11',
            },
        };

        const date = extractDateFromExif(exifData);

        expect(date).not.toBeNull();
        expect(date?.getFullYear()).toBe(2023);
        expect(date?.getMonth()).toBe(5);
        expect(date?.getDate()).toBe(3);
    });

    it('DateTimeOriginal과 0th.DateTime이 다를 때 전자를 택한다 (버그의 핵심 케이스)', () => {
        const exifData: Exif = {
            Exif: {
                [EXIF_IFD_DATE_TIME_ORIGINAL]: '2022:08:15 10:00:00',
            },
            '0th': {
                [IMAGE_IFD_DATE_TIME]: '2026:08:22 18:30:00',
            },
        };

        const date = extractDateFromExif(exifData);

        expect(date).not.toBeNull();
        expect(date?.getFullYear()).toBe(2022);
        expect(date?.getMonth()).toBe(7);
        expect(date?.getDate()).toBe(15);
    });

    it('"0000:00:00 00:00:00" → null (이전에는 Invalid Date)', () => {
        const exifData: Exif = {
            Exif: {
                [EXIF_IFD_DATE_TIME_ORIGINAL]: '0000:00:00 00:00:00',
            },
        };

        expect(extractDateFromExif(exifData)).toBeNull();
    });

    it('"2023:04:01" (시간 없음) → null', () => {
        const exifData: Exif = {
            Exif: {
                [EXIF_IFD_DATE_TIME_ORIGINAL]: '2023:04:01',
            },
        };

        expect(extractDateFromExif(exifData)).toBeNull();
    });

    it('셋 다 없으면 null', () => {
        const exifData: Exif = {};

        expect(extractDateFromExif(exifData)).toBeNull();
    });

    it('exifData 자체가 null이면 null', () => {
        expect(extractDateFromExif(null)).toBeNull();
    });
});
