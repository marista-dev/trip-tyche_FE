import { PinPoint } from '@/domains/route/types';

export const sortPinPointByDate = (pinPoints: PinPoint[]) =>
    pinPoints.sort((pinPointA: PinPoint, pinPointB: PinPoint) => {
        return new Date(pinPointA.recordDate).getTime() - new Date(pinPointB.recordDate).getTime();
    });

/**
 * 하버사인 공식을 사용해 두 좌표의 거리 계산
 * @param latitude1 시작 좌표의 위도
 * @param longitude1 시작 좌표의 경도
 * @param latitude2 끝 좌표의 위도
 * @param longitude2 끝 좌표의 경도
 * @returns 두 좌표 거리 (km)
 */
export const calculateDistance = (
    latitude1: number,
    longitude1: number,
    latitude2: number,
    longitude2: number,
): number => {
    const R = 6371;
    const dLat = (latitude2 - latitude1) * (Math.PI / 180);
    const dLon = (longitude2 - longitude1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(latitude1 * (Math.PI / 180)) *
            Math.cos(latitude2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * 두 PinPoint 사이의 방위각(bearing) — 북쪽 기준 시계방향 0~360°
 * Spherical 공식 (위도에 따른 경도 거리 보정 포함). 국제선급 장거리에서도 정확.
 * Google Maps heading과 동일 형식 (0°=북, 90°=동, 180°=남, 270°=서).
 */
export const bearing = (start: PinPoint, end: PinPoint): number => {
    const RAD = Math.PI / 180;
    const phi1 = start.latitude * RAD;
    const phi2 = end.latitude * RAD;
    const deltaLambda = (end.longitude - start.longitude) * RAD;
    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    const deg = (Math.atan2(y, x) * 180) / Math.PI;
    return (deg + 360) % 360;
};
