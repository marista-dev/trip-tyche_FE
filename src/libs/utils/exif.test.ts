import { describe, it, expect } from 'vitest';

import { extractDateFromExif, parseExifDateTime, readDateTimeTags } from './exif';
import type { Exif } from '@/shared/types/exif';

// EXIF 태그 번호 (piexifjs 상수와 동일)
const EXIF_IFD_DATE_TIME_ORIGINAL = 36867;
const EXIF_IFD_DATE_TIME_DIGITIZED = 36868;
const IMAGE_IFD_DATE_TIME = 306;

describe('readDateTimeTags', () => {
    it('우선순위 순으로 후보를 반환한다 (DateTimeOriginal이 첫 번째)', () => {
        const exifData: Exif = {
            Exif: {
                [EXIF_IFD_DATE_TIME_ORIGINAL]: '2023:04:01 12:34:56',
                [EXIF_IFD_DATE_TIME_DIGITIZED]: '2023:04:02 12:34:56',
            },
            '0th': {
                [IMAGE_IFD_DATE_TIME]: '2023:04:03 12:34:56',
            },
        };

        expect(readDateTimeTags(exifData)).toEqual([
            '2023:04:01 12:34:56',
            '2023:04:02 12:34:56',
            '2023:04:03 12:34:56',
        ]);
    });

    it('없는 태그는 건너뛴다', () => {
        const exifData: Exif = {
            Exif: {
                [EXIF_IFD_DATE_TIME_DIGITIZED]: '2023:05:02 08:00:00',
            },
        };

        expect(readDateTimeTags(exifData)).toEqual(['2023:05:02 08:00:00']);
    });

    it('Exif IFD가 통째로 없으면 0th.DateTime만 반환한다', () => {
        const exifData: Exif = {
            '0th': {
                [IMAGE_IFD_DATE_TIME]: '2023:06:03 09:10:11',
            },
        };

        expect(readDateTimeTags(exifData)).toEqual(['2023:06:03 09:10:11']);
    });

    it('문자열이 아닌 값은 제외한다 — parseExifDateTime의 TypeError를 막는다', () => {
        // IfdData의 값 타입은 string | number | number[] | [number, number][]이므로
        // 손상된 파일에서는 날짜 태그에 숫자가 들어올 수 있다.
        const exifData: Exif = {
            Exif: {
                [EXIF_IFD_DATE_TIME_ORIGINAL]: 20230401 as unknown as string,
            },
            '0th': {
                [IMAGE_IFD_DATE_TIME]: '2023:06:03 09:10:11',
            },
        };

        expect(readDateTimeTags(exifData)).toEqual(['2023:06:03 09:10:11']);
    });

    it('셋 다 없으면 빈 배열을 반환한다', () => {
        const exifData: Exif = {};

        expect(readDateTimeTags(exifData)).toEqual([]);
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

    it('상위 태그가 무효하면 하위 후보로 폴백한다', () => {
        // 첫 후보만 보고 파싱하면 무효한 DateTimeOriginal 하나가
        // 멀쩡한 DateTimeDigitized·0th.DateTime을 가려 날짜 미지정이 된다.
        const exifData: Exif = {
            Exif: {
                [EXIF_IFD_DATE_TIME_ORIGINAL]: '0000:00:00 00:00:00',
                [EXIF_IFD_DATE_TIME_DIGITIZED]: '2023:07:04 15:20:30',
            },
            '0th': {
                [IMAGE_IFD_DATE_TIME]: '2026:01:01 00:00:00',
            },
        };

        const date = extractDateFromExif(exifData);

        expect(date).not.toBeNull();
        expect(date?.getFullYear()).toBe(2023);
        expect(date?.getMonth()).toBe(6);
        expect(date?.getDate()).toBe(4);
    });

    it('상위 태그가 문자열이 아니어도 throw하지 않고 하위 후보를 쓴다', () => {
        const exifData: Exif = {
            Exif: {
                [EXIF_IFD_DATE_TIME_ORIGINAL]: 20230401 as unknown as string,
            },
            '0th': {
                [IMAGE_IFD_DATE_TIME]: '2023:06:03 09:10:11',
            },
        };

        expect(() => extractDateFromExif(exifData)).not.toThrow();
        expect(extractDateFromExif(exifData)?.getFullYear()).toBe(2023);
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
