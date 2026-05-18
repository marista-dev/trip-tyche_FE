import { ClientImageFile, ImageProcessStatusType, ImageUploadStepType, MediaFile } from '@/domains/media/types';
import { hasValidDate, hasValidLocation } from '@/libs/utils/validate';

const EARTH_RADIUS_M = 6_371_000;
const TIME_WINDOW_MS_DEFAULT = 30 * 60 * 1000;
const LOCATION_RADIUS_M_DEFAULT = 500;

// 두 좌표 사이 거리(미터). 1000장 규모에서도 단순 산식이라 비용 무시할 만함.
export const haversineMeters = (
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
): number => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(x));
};

// 위치 없는 target 1장 → 같은 trip의 ±windowMs 이내 '위치 있는' 사진들 (가까운 시간 순)
export const findNearbyPhotosByTime = (
    target: MediaFile,
    pool: MediaFile[],
    windowMs: number = TIME_WINDOW_MS_DEFAULT,
): Array<MediaFile & { diffMs: number }> => {
    if (!hasValidDate(target.recordDate)) return [];
    const targetTime = new Date(target.recordDate).getTime();
    if (Number.isNaN(targetTime)) return [];
    return pool
        .filter(
            (p) =>
                p.mediaFileId !== target.mediaFileId &&
                hasValidLocation({ latitude: p.latitude, longitude: p.longitude }) &&
                hasValidDate(p.recordDate),
        )
        .map((p) => ({ ...p, diffMs: new Date(p.recordDate).getTime() - targetTime }))
        .filter((p) => !Number.isNaN(p.diffMs) && Math.abs(p.diffMs) <= windowMs)
        .sort((a, b) => Math.abs(a.diffMs) - Math.abs(b.diffMs));
};

// 날짜 없는 target 1장 → 주변 radiusMeters 이내 '날짜 있는' 사진들 (가까운 거리 순)
export const findNearbyPhotosByLocation = (
    target: MediaFile,
    pool: MediaFile[],
    radiusMeters: number = LOCATION_RADIUS_M_DEFAULT,
): Array<MediaFile & { distM: number }> => {
    if (!hasValidLocation({ latitude: target.latitude, longitude: target.longitude })) return [];
    return pool
        .filter(
            (p) =>
                p.mediaFileId !== target.mediaFileId &&
                hasValidDate(p.recordDate) &&
                hasValidLocation({ latitude: p.latitude, longitude: p.longitude }),
        )
        .map((p) => ({ ...p, distM: haversineMeters(target, p) }))
        .filter((p) => p.distM <= radiusMeters)
        .sort((a, b) => a.distM - b.distM);
};

// "5분 전" / "12분 후" / "1시간 전" 등 사람이 읽기 좋은 시간차 라벨
export const formatTimeDiff = (diffMs: number): string => {
    const totalMin = Math.round(diffMs / 60_000);
    const absMin = Math.abs(totalMin);
    if (absMin === 0) return '같은 시각';
    const suffix = totalMin < 0 ? '전' : '후';
    if (absMin < 60) return `${absMin}분 ${suffix}`;
    const hours = Math.floor(absMin / 60);
    const remainMin = absMin % 60;
    return remainMin === 0 ? `${hours}시간 ${suffix}` : `${hours}시간 ${remainMin}분 ${suffix}`;
};

// 거리 라벨: 50m, 120m, 1.2km
export const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
};

// "HH:MM" 추출
export const extractTimeOfDay = (isoLike: string): string => {
    if (!isoLike) return '';
    const d = new Date(isoLike);
    if (Number.isNaN(d.getTime())) return '';
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
};

/**
 * 위치, 날짜 모두 유효한 미디어 파일 필터링
 * @param mediaFiles 필터링할 미디어 파일 배열
 * @returns 위치, 날짜 모두 유효한 미디어 파일 배열
 */
export const filterValidMediaFile = (metadatas: ClientImageFile[] | MediaFile[]) =>
    metadatas.filter(
        (metadata) =>
            hasValidLocation({ latitude: metadata.latitude, longitude: metadata.longitude }) &&
            hasValidDate(metadata.recordDate),
    );

/**
 * 유효하지 않은 위치(기본위치: {latitude: 0, longtitude: 0})를 가진 이미지 파일만 필터링
 * @param mediaFiles 필터링할 미디어 파일 배열
 * @returns 위치 없는 미디어 파일 배열
 */
export const filterWithoutLocationMediaFile = (metadatas: ClientImageFile[] | MediaFile[]) =>
    metadatas.filter((metadata) => !hasValidLocation({ latitude: metadata.latitude, longitude: metadata.longitude }));

/**
 * 유효하지 않은 날짜(기본날짜: 1980-01-01)를 가진 미디어 파일만 필터링
 * @param mediaFiles 필터링할 미디어 파일 배열
 * @returns 날짜 없는 미디어 파일 배열
 */
export const filterWithoutDateMediaFile = (metadatas: ClientImageFile[] | MediaFile[]) =>
    metadatas.filter((metadata) => !hasValidDate(metadata.recordDate));

export const removeDuplicateDates = (datesString: string[]) =>
    [...new Set<string>([...datesString])].sort((a, b) => a.localeCompare(b));

export const getTitleByStep = (step: ImageUploadStepType) => {
    switch (step) {
        case 'upload':
            return '여행 사진 등록';
        case 'processing':
            return '사진 처리 중';
        case 'review':
            return '처리된 사진 정보';
        case 'info':
            return '';
        case 'done':
            return '';
    }
};

export const getAlertBoxMessage = (currentProcess: ImageProcessStatusType) => {
    if (currentProcess === 'metadata') {
        return {
            title: '사진 정보 수집 중...',
            description: '소중한 추억의 장소와 날짜를 기억하고 있어요.',
        };
    } else if (currentProcess === 'upload') {
        return {
            title: '안전하게 저장 중...',
            description: '소중한 사진을 안전하게 저장하고 있어요.',
        };
    }
    return {
        title: '문제가 발생했나요?',
        description: '새로고침 및 서비스 종료 후 다시 이용해주세요.',
    };
};

export const getImageDateFromImage = (images: ClientImageFile[] | null) => {
    if (!images || images?.length === 0) return null;
    const imageDates = images?.map((image: ClientImageFile) => image.recordDate.split('T')[0]);
    const validDates = imageDates.filter((date) => date);

    return removeDuplicateDates(validDates);
};

export const getImageGroupByDate = (images: MediaFile[]) => {
    const group = images.reduce<
        Record<
            string,
            {
                recordDate: string;
                images: MediaFile[];
            }
        >
    >((acc, curr) => {
        const date = curr.recordDate.split('T')[0];

        if (!acc[date]) {
            acc[date] = { recordDate: date, images: [curr] };
        } else {
            acc[date].images = [...acc[date].images, curr];
        }

        return acc;
    }, {});

    return Object.values(group).sort(
        (
            dateA: {
                recordDate: string;
                images: MediaFile[];
            },
            dateB: {
                recordDate: string;
                images: MediaFile[];
            },
        ) => new Date(dateA.recordDate).getTime() - new Date(dateB.recordDate).getTime(),
    );
};
