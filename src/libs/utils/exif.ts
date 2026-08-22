import piexif from 'piexifjs';

import { Exif } from '@/shared/types/exif';
import { Location } from '@/shared/types/map';

// 이미지 파일에서 EXIF 데이터 추출
const readExifData = (file: File): Promise<Exif | null> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
            const result = e.target?.result;

            if (typeof result === 'string') {
                try {
                    const exif = piexif.load(result) as Exif;
                    resolve(exif);
                } catch (error) {
                    resolve(null);
                }
            } else {
                reject(new Error('Failed to read image file as string'));
            }
        };

        reader.readAsDataURL(file);
        reader.onerror = (error) => reject(error);
    });
};

// DMS(도, 분, 초) 형식의 GPS 데이터를 DD(십진수) 형식으로 변환
const convertDMSToDD = (degrees: number, minutes: number, seconds: number, direction: string): number => {
    // DMS 형식을 DD 형식으로 변환
    let dd = degrees + minutes / 60 + seconds / 3600;
    if (direction === 'S' || direction === 'W') {
        dd = dd * -1;
    }
    return dd;
};

// EXIF 데이터에서 GPS 좌표 추출
const extractGpsFromExifData = (exifObj: Exif): Location | null => {
    if (!exifObj || !exifObj['GPS']) return null;
    const gps = exifObj['GPS'];

    /*
     * GPSLatitude, GPSLatitudeRef: 위도 정보와 그에 해당하는 참조(방향)
     * GPSLongitude, GPSLongitudeRef: 경도 정보와 그에 해당하는 참조(방향)
     */
    const latData = gps[piexif.GPSIFD.GPSLatitude] as [number, number][] | undefined;
    const latRef = gps[piexif.GPSIFD.GPSLatitudeRef] as string | undefined;
    const lonData = gps[piexif.GPSIFD.GPSLongitude] as [number, number][] | undefined;
    const lonRef = gps[piexif.GPSIFD.GPSLongitudeRef] as string | undefined;

    if (!latData || !latRef || !lonData || !lonRef) {
        return null;
    }

    try {
        const latitude = convertDMSToDD(
            latData[0][0] / latData[0][1],
            latData[1][0] / latData[1][1],
            latData[2][0] / latData[2][1],
            latRef,
        );
        const longitude = convertDMSToDD(
            lonData[0][0] / lonData[0][1],
            lonData[1][0] / lonData[1][1],
            lonData[2][0] / lonData[2][1],
            lonRef,
        );

        return { latitude, longitude };
    } catch (error) {
        console.error('EXIF 데이터에서 GPS 좌표 추출 실패: ', error);
        return null;
    }
};

// EXIF 데이터에서 촬영시각 태그를 우선순위에 따라 조회
// Exif.DateTimeOriginal(셔터 촬영 시각) → Exif.DateTimeDigitized(디지털화 시각) → 0th.DateTime(파일 기록/수정 시각) 순으로 폴백
// 편집·재저장되거나 메신저를 거친 사진은 0th.DateTime만 오늘 날짜로 덮어써지므로, 촬영시각 태그를 우선해야 한다
export const readDateTimeTag = (exifData: Exif): string | undefined => {
    const exifIfd = exifData['Exif'];
    const zerothIfd = exifData['0th'];

    return (
        (exifIfd?.[piexif.ExifIFD.DateTimeOriginal] as string | undefined) ??
        (exifIfd?.[piexif.ExifIFD.DateTimeDigitized] as string | undefined) ??
        (zerothIfd?.[piexif.ImageIFD.DateTime] as string | undefined)
    );
};

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
export const extractDateFromExif = (exifData: Exif | null): Date | null => {
    if (!exifData) return null;

    const dateTimeTag = readDateTimeTag(exifData);
    if (!dateTimeTag) return null;

    return parseExifDateTime(dateTimeTag);
};

// 파일에서 EXIF를 정확히 1회만 읽어 위치·날짜를 함께 추출한다.
// extractLocationFromImage/extractDateFromImage를 따로 호출하면 같은 파일을 base64로 두 번
// 읽게 되므로(각각 readExifData 호출), 대량 업로드 시 메모리 낭비가 크다.
export const extractMetadataFromExif = async (
    file: File,
): Promise<{ location: Location | null; date: Date | null }> => {
    try {
        const exifData = await readExifData(file);
        if (!exifData) return { location: null, date: null };

        return {
            location: extractGpsFromExifData(exifData),
            date: extractDateFromExif(exifData),
        };
    } catch (error) {
        console.error(`${file.name} 메타데이터 추출 실패: `, error);
        return { location: null, date: null };
    }
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
