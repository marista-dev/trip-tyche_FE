import { parse as parseExif } from 'exifr';

import { Exif } from '@/shared/types/exif';
import { Location } from '@/shared/types/map';

/* EXIF 태그 번호 (TIFF/EXIF 표준) */
const TAG = {
    DateTime: 306, // IFD0
    DateTimeOriginal: 36867, // Exif IFD
    DateTimeDigitized: 36868, // Exif IFD
    GPSLatitudeRef: 1,
    GPSLatitude: 2,
    GPSLongitudeRef: 3,
    GPSLongitude: 4,
} as const;

/*
 * exifr로 필요한 IFD만, 파일 앞부분만 읽는다. JPEG·HEIC 모두 지원한다.
 * 예전 방식(파일 전체를 base64로 읽어 JPEG만 해석)은 장당 수 MB 문자열을 만들었고,
 * HEIC는 먼저 JPEG로 바꿔야 했는데 그 변환이 EXIF를 지워 GPS를 잃었다.
 *
 * 키·값 변환을 끄면 태그 번호 그대로, 날짜는 'YYYY:MM:DD HH:mm:ss' 문자열 그대로 온다.
 * 이를 Exif 구조('0th'/'Exif'/'GPS')로 옮겨 아래 날짜·GPS 로직을 그대로 쓴다.
 * 유리수는 [분자, 분모] 대신 숫자로 온다(GPS를 읽을 때 두 형식을 모두 받는다).
 */
const readExifData = async (file: File): Promise<Exif | null> => {
    const raw = (await parseExif(file, {
        tiff: true,
        exif: true,
        gps: true,
        ifd1: false,
        interop: false,
        xmp: false,
        icc: false,
        iptc: false,
        jfif: false,
        ihdr: false,
        makerNote: false,
        userComment: false,
        mergeOutput: false,
        translateKeys: false,
        translateValues: false,
        reviveValues: false,
    })) as { ifd0?: Exif['0th']; exif?: Exif['Exif']; gps?: Exif['GPS'] } | undefined;
    if (!raw) return null;
    return { '0th': raw.ifd0, Exif: raw.exif, GPS: raw.gps };
};

// DMS(도, 분, 초) 형식의 GPS 데이터를 DD(십진수) 형식으로 변환
const convertDMSToDD = (degrees: number, minutes: number, seconds: number, direction: string): number => {
    let dd = degrees + minutes / 60 + seconds / 3600;
    if (direction === 'S' || direction === 'W') {
        dd = dd * -1;
    }
    return dd;
};

/** 유리수 하나: 숫자 또는 [분자, 분모] */
const toNumber = (value: unknown): number =>
    Array.isArray(value) ? Number(value[0]) / Number(value[1]) : Number(value);

/** [도, 분, 초] → 숫자 3개. 형식이 다르면 null */
const toDMS = (value: unknown): [number, number, number] | null => {
    if (!Array.isArray(value) || value.length < 3) return null;
    const dms = value.slice(0, 3).map(toNumber) as [number, number, number];
    return dms.every(Number.isFinite) ? dms : null;
};

// EXIF 데이터에서 GPS 좌표 추출
const extractGpsFromExifData = (exifObj: Exif): Location | null => {
    const gps = exifObj?.GPS;
    if (!gps) return null;

    const lat = toDMS(gps[TAG.GPSLatitude]);
    const latRef = gps[TAG.GPSLatitudeRef];
    const lon = toDMS(gps[TAG.GPSLongitude]);
    const lonRef = gps[TAG.GPSLongitudeRef];

    if (!lat || !lon || typeof latRef !== 'string' || typeof lonRef !== 'string') {
        return null;
    }

    return {
        latitude: convertDMSToDD(...lat, latRef),
        longitude: convertDMSToDD(...lon, lonRef),
    };
};

// 촬영시각 후보 태그 — 우선순위 순
// DateTimeOriginal(셔터를 누른 시각) → DateTimeDigitized(디지털화 시각) → 0th.DateTime(파일 기록/수정 시각).
// 편집·재저장되거나 메신저를 거친 사진은 0th.DateTime만 덮어써지므로 촬영시각 태그를 우선한다.
const DATETIME_TAG_CANDIDATES = [
    ['Exif', TAG.DateTimeOriginal],
    ['Exif', TAG.DateTimeDigitized],
    ['0th', TAG.DateTime],
] as const;

// 우선순위 순으로 촬영시각 후보를 모두 반환한다.
// IfdData의 값은 문자열이 아닐 수 있으므로(숫자·유리수 배열 등) 문자열만 통과시킨다.
// 이 필터가 없으면 파싱 단계의 raw.match가 TypeError를 던진다.
export const readDateTimeTags = (exifData: Exif): string[] =>
    DATETIME_TAG_CANDIDATES.map(([ifd, tag]) => exifData[ifd]?.[tag]).filter(
        (value): value is string => typeof value === 'string',
    );

// EXIF 날짜 형식: "YYYY:MM:DD HH:mm:ss" (예: "2023:04:01 12:34:56")
const EXIF_DATETIME_PATTERN = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

// EXIF 날짜 문자열을 Date로 파싱. 형식이 다르거나("2023:04:01" 등) "0000:00:00 00:00:00" 같은
// 빈 값/범위를 벗어난 값이면 null을 반환한다 (Invalid Date를 반환하지 않음)
export const parseExifDateTime = (raw: string): Date | null => {
    const matched = raw.match(EXIF_DATETIME_PATTERN);
    if (!matched) return null;

    const [, year, month, day, hour, minute, second] = matched;
    const y = +year;
    const mo = +month;
    const d = +day;
    const h = +hour;
    const mi = +minute;
    const s = +second;

    const date = new Date(y, mo - 1, d, h, mi, s);

    /*
     * new Date(...)는 범위를 벗어난 값을 던지지 않고 조용히 보정(rollover)한다.
     * 예: new Date(0, -1, 0, ...)는 Invalid Date가 아니라 1899년 근처의 엉뚱한 날짜가 된다
     * (Date 생성자가 0~99 사이 연도를 1900+연도로 특별 취급하는 규칙까지 겹치기 때문).
     * 따라서 Number.isNaN만으로는 "0000:00:00 00:00:00" 같은 빈 값을 걸러낼 수 없어,
     * 생성된 Date에서 각 필드를 역으로 읽어 입력값과 일치하는지 검증한다.
     */
    const isRoundTripValid =
        date.getFullYear() === y &&
        date.getMonth() === mo - 1 &&
        date.getDate() === d &&
        date.getHours() === h &&
        date.getMinutes() === mi &&
        date.getSeconds() === s;

    return isRoundTripValid ? date : null;
};

// EXIF 객체 → Date 순수 함수 (File 접근 없이 테스트 가능)
// 후보를 우선순위대로 시도해 처음 파싱에 성공한 값을 쓴다.
// 첫 후보만 보고 파싱하면 무효한 DateTimeOriginal("0000:00:00 00:00:00" 등) 하나가
// 하위 태그에 남아 있는 멀쩡한 촬영시각을 가려버린다.
export const extractDateFromExif = (exifData: Exif | null): Date | null => {
    if (!exifData) return null;

    for (const raw of readDateTimeTags(exifData)) {
        const parsed = parseExifDateTime(raw);
        if (parsed) return parsed;
    }

    return null;
};

// 파일에서 EXIF를 정확히 1회만 읽어 위치·날짜를 함께 추출한다.
// extractLocationFromImage/extractDateFromImage를 따로 호출하면 같은 파일을 두 번 읽는다.
export const extractMetadataFromExif = async (
    file: File,
): Promise<{ location: Location | null; date: Date | null }> => {
    let exifData: Exif | null;

    try {
        exifData = await readExifData(file);
    } catch (error) {
        console.error(`${file.name} EXIF 읽기 실패: `, error);
        return { location: null, date: null };
    }

    if (!exifData) return { location: null, date: null };

    /*
     * 위치와 날짜는 서로 독립적으로 실패해야 한다.
     * 하나의 try로 묶으면 깨진 날짜 태그 하나가 이미 정상 추출된 GPS까지 함께 폐기시킨다.
     * 이 앱은 사진 EXIF의 GPS로 지도 핀을 찍으므로 위치 손실이 가장 비싼 실패다.
     */
    let location: Location | null = null;
    let date: Date | null = null;

    try {
        location = extractGpsFromExifData(exifData);
    } catch (error) {
        console.error(`${file.name} 위치 추출 실패: `, error);
    }

    try {
        date = extractDateFromExif(exifData);
    } catch (error) {
        console.error(`${file.name} 날짜 추출 실패: `, error);
    }

    return { location, date };
};

// 이미지에서 위치 추출
export const extractLocationFromImage = async (file: File): Promise<Location | null> => {
    const { location } = await extractMetadataFromExif(file);
    return location;
};

// 이미지에서 날짜 추출
export const extractDateFromImage = async (file: File): Promise<Date | null> => {
    const { date } = await extractMetadataFromExif(file);
    return date;
};
