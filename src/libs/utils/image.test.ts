import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { extractMetadataFromImage } from './image';

// piexifjs 실물은 실제 JPEG 바이너리가 필요해 테스트에서 재현하기 번거로우므로 목으로 대체한다.
// FileReader 목이 만들어내는 "data:fake;filename=..." 문자열에서 파일명을 읽어,
// 테스트가 미리 등록해둔 exifFixtures를 그대로 반환하도록 한다.
const exifFixtures = new Map<string, Record<string, unknown>>();

// vi.mock 팩토리는 파일 최상단으로 호이스팅되므로, 팩토리 안에서 참조하는 상수는
// vi.hoisted로 함께 끌어올려야 "before initialization" 에러 없이 공유할 수 있다.
const { GPSIFD, ExifIFD, ImageIFD } = vi.hoisted(() => ({
    GPSIFD: { GPSLatitudeRef: 1, GPSLatitude: 2, GPSLongitudeRef: 3, GPSLongitude: 4 },
    ExifIFD: { DateTimeOriginal: 36867, DateTimeDigitized: 36868 },
    ImageIFD: { DateTime: 306 },
}));

vi.mock('piexifjs', () => {
    const load = (data: string) => {
        const filename = data.match(/filename=([^;]+)/)?.[1];
        const fixture = filename ? exifFixtures.get(filename) : undefined;
        if (!fixture) {
            throw new Error(`no exif fixture registered for "${filename}"`);
        }
        return fixture;
    };

    const api = { GPSIFD, ExifIFD, ImageIFD, load };
    return { default: api, ...api };
});

// 실제 FileReader 대신, readAsDataURL 호출 횟수를 파일 단위로 세는 목.
// 파일명을 결과 문자열에 그대로 실어 보내 piexifjs 목이 그 파일의 fixture를 찾을 수 있게 한다.
let readAsDataURLCallCounts: Map<File, number>;

class FakeFileReader {
    result: string | null = null;
    onload: ((ev: { target: { result: string | null } }) => void) | null = null;
    onerror: ((ev: unknown) => void) | null = null;

    readAsDataURL(file: File) {
        readAsDataURLCallCounts.set(file, (readAsDataURLCallCounts.get(file) ?? 0) + 1);

        queueMicrotask(() => {
            this.result = `data:fake;filename=${file.name}`;
            this.onload?.({ target: { result: this.result } });
        });
    }
}

function makeGpsFixture(lat: number, latRef: 'N' | 'S', lon: number, lonRef: 'E' | 'W') {
    return {
        GPS: {
            [GPSIFD.GPSLatitude]: [
                [lat, 1],
                [0, 1],
                [0, 1],
            ],
            [GPSIFD.GPSLatitudeRef]: latRef,
            [GPSIFD.GPSLongitude]: [
                [lon, 1],
                [0, 1],
                [0, 1],
            ],
            [GPSIFD.GPSLongitudeRef]: lonRef,
        },
    };
}

function makeDateFixture(exifDateTime: string) {
    return {
        Exif: {
            [ExifIFD.DateTimeOriginal]: exifDateTime,
        },
    };
}

beforeEach(() => {
    readAsDataURLCallCounts = new Map();
    exifFixtures.clear();
    vi.stubGlobal('FileReader', FakeFileReader);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('extractMetadataFromImage', () => {
    it('파일당 readAsDataURL 호출 횟수가 1회다 (03 이전에는 2회였다)', async () => {
        const file = new File(['x'], 'single.jpg', { type: 'image/jpeg' });
        exifFixtures.set('single.jpg', {});

        await extractMetadataFromImage([file]);

        expect(readAsDataURLCallCounts.get(file)).toBe(1);
    });

    it('반환 배열의 각 원소가 입력 File과 순서대로 올바르게 짝지어진다', async () => {
        const fileA = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
        const fileB = new File(['b'], 'b.jpg', { type: 'image/jpeg' });
        const fileC = new File(['c'], 'c.jpg', { type: 'image/jpeg' });

        exifFixtures.set('a.jpg', {
            ...makeGpsFixture(35, 'N', 139, 'E'),
            ...makeDateFixture('2023:04:01 12:00:00'),
        });
        exifFixtures.set('b.jpg', {
            ...makeGpsFixture(48, 'N', 2, 'E'),
            ...makeDateFixture('2022:01:15 09:30:00'),
        });
        exifFixtures.set('c.jpg', {});

        const result = await extractMetadataFromImage([fileA, fileB, fileC]);

        expect(result).toHaveLength(3);

        expect(result[0].image).toBe(fileA);
        expect(result[0].latitude).toBe(35);
        expect(result[0].longitude).toBe(139);
        expect(result[0].recordDate).toBe('2023-04-01T12:00:00');

        expect(result[1].image).toBe(fileB);
        expect(result[1].latitude).toBe(48);
        expect(result[1].longitude).toBe(2);
        expect(result[1].recordDate).toBe('2022-01-15T09:30:00');

        expect(result[2].image).toBe(fileC);
        expect(result[2].latitude).toBe(0);
        expect(result[2].longitude).toBe(0);
        expect(result[2].recordDate).toBe('');
    });

    it('날짜 태그가 깨져 있어도 GPS는 살아남는다', async () => {
        // 위치와 날짜를 하나의 try로 묶으면, 날짜 파싱이 던진 예외가 이미 정상 추출된
        // GPS까지 함께 폐기시킨다. 이 앱은 EXIF GPS로 지도 핀을 찍으므로 가장 비싼 실패다.
        const file = new File(['x'], 'broken-date.jpg', { type: 'image/jpeg' });
        exifFixtures.set('broken-date.jpg', {
            ...makeGpsFixture(37, 'N', 127, 'E'),
            Exif: {
                // IfdData의 값은 문자열이 아닐 수 있다 (손상된 파일에서 숫자가 들어오는 경우)
                [ExifIFD.DateTimeOriginal]: 20230401,
            },
        });

        const result = await extractMetadataFromImage([file]);

        expect(result[0].latitude).toBe(37);
        expect(result[0].longitude).toBe(127);
        expect(result[0].recordDate).toBe(''); // 날짜만 미지정으로 떨어진다
    });

    it('GPS가 깨져 있어도 날짜는 살아남는다', async () => {
        const file = new File(['x'], 'broken-gps.jpg', { type: 'image/jpeg' });
        exifFixtures.set('broken-gps.jpg', {
            GPS: {
                [GPSIFD.GPSLatitude]: 'not-a-rational',
                [GPSIFD.GPSLatitudeRef]: 'N',
                [GPSIFD.GPSLongitude]: 'not-a-rational',
                [GPSIFD.GPSLongitudeRef]: 'E',
            },
            ...makeDateFixture('2023:04:01 12:00:00'),
        });

        const result = await extractMetadataFromImage([file]);

        expect(result[0].recordDate).toBe('2023-04-01T12:00:00');
        expect(result[0].latitude).toBe(0);
        expect(result[0].longitude).toBe(0);
    });

    it('onProgress가 최종적으로 100에 도달한다', async () => {
        const files = Array.from({ length: 7 }, (_, i) => new File(['x'], `img${i}.jpg`, { type: 'image/jpeg' }));
        files.forEach((f) => exifFixtures.set(f.name, {}));

        type Progress = { metadata: number; upload: number };
        let lastProgress: Progress = { metadata: 0, upload: 0 };
        const onProgress = vi.fn((action: Progress | ((prev: Progress) => Progress)) => {
            lastProgress = typeof action === 'function' ? action(lastProgress) : action;
        });

        await extractMetadataFromImage(files, onProgress);

        expect(lastProgress.metadata).toBe(100);
    });

    it('EXIF에 위치·날짜가 없는 파일은 latitude:0, longitude:0, recordDate:"" 로 분류된다', async () => {
        const file = new File(['x'], 'no-exif.jpg', { type: 'image/jpeg' });
        exifFixtures.set('no-exif.jpg', {});

        const [result] = await extractMetadataFromImage([file]);

        expect(result.latitude).toBe(0);
        expect(result.longitude).toBe(0);
        expect(result.recordDate).toBe('');
    });

    it('빈 배열이면 빈 배열을 반환한다', async () => {
        const result = await extractMetadataFromImage([]);
        expect(result).toEqual([]);
    });
});
