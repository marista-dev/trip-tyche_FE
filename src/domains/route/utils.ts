import { PinPoint } from '@/domains/route/types';
import { ZOOM_SCALE } from '@/shared/constants/map';

/**
 * 기본 위치{latitude: 0, longtitude: 0}가 아닌 유효한 위치를 가진 핀포인트만 필터링
 * @param mediaFiles 필터링할 핀포인트 배열
 * @returns 유효한 위치를 가진 핀포인트 배열
 */
export const filterValidLocationPinPoint = (pinPoints: PinPoint[]) =>
    pinPoints.filter((pinPoint: PinPoint) => pinPoint.latitude !== 0 && pinPoint.longitude !== 0);

export const sortPinPointByDate = (pinPoints: PinPoint[]) =>
    pinPoints.sort((pinPointA: PinPoint, pinPointB: PinPoint) => {
        return new Date(pinPointA.recordDate).getTime() - new Date(pinPointB.recordDate).getTime();
    });

/**
 * 하버사인 공식을 사용해 두 좌표의 거리 계산
 * @param latitude1 시작 좌표의 경도
 * @param longitude1
 * @param latitude2
 * @param longitude2
 * @returns 두 좌표 거리
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

// export const getAnimationConfig = (distance: number) => {
//     if (distance < 0.5) {
//         return {
//             transportType: 'walking',
//             zoomLevel: ZOOM_SCALE.DEFAULT,
//             duration: 1000,
//         };
//     } else if (distance < 2) {
//         return {
//             transportType: 'walking',
//             zoomLevel: ZOOM_SCALE.DEFAULT,
//             duration: 2000,
//         };
//     } else if (distance < 5) {
//         return {
//             transportType: 'walking',
//             zoomLevel: ZOOM_SCALE.DEFAULT,
//             duration: 3000,
//         };
//     } else if (distance < 10) {
//         return {
//             transportType: 'walking',
//             zoomLevel: ZOOM_SCALE.DEFAULT,
//             duration: 3500,
//         };
//     } else if (distance < 20) {
//         return {
//             transportType: 'car',
//             zoomLevel: ZOOM_SCALE.DEFAULT - 1,
//             duration: 8000,
//         };
//     } else if (distance < 50) {
//         return {
//             transportType: 'car',
//             zoomLevel: ZOOM_SCALE.DEFAULT - 1,
//             duration: 8000,
//         };
//     } else if (distance < 200) {
//         return {
//             transportType: 'plane',
//             zoomLevel: 9,
//             duration: 6000,
//         };
//     } else if (distance < 500) {
//         return {
//             transportType: 'plane',
//             zoomLevel: 8,
//             duration: 7000,
//         };
//     } else if (distance < 1000) {
//         return {
//             transportType: 'plane',
//             zoomLevel: 7,
//             duration: 8000,
//         };
//     } else {
//         return {
//             transportType: 'plane',
//             zoomLevel: 3,
//             duration: 8000,
//         };
//     }
// };

export const getAnimationConfig = (distance: number) => {
    if (distance < 1) {
        return {
            transportType: 'walking',
            zoomLevel: ZOOM_SCALE.DEFAULT,
            duration: 1500,
            tilt: 0,
            headingDelta: 0,
        };
    } else if (distance < 5) {
        return {
            transportType: 'walking',
            zoomLevel: ZOOM_SCALE.DEFAULT,
            duration: 3000,
            tilt: 0,
            headingDelta: 0,
        };
    } else if (distance < 10) {
        return {
            transportType: 'car',
            zoomLevel: ZOOM_SCALE.DEFAULT - 1,
            duration: 5000,
            tilt: 30,
            headingDelta: 15,
        };
    } else if (distance < 50) {
        return {
            transportType: 'car',
            zoomLevel: ZOOM_SCALE.DEFAULT - 1,
            duration: 6000,
            tilt: 30,
            headingDelta: 15,
        };
    } else if (distance < 70) {
        return {
            transportType: 'car',
            zoomLevel: ZOOM_SCALE.DEFAULT - 1,
            duration: 7000,
            tilt: 30,
            headingDelta: 15,
        };
    } else if (distance < 100) {
        return {
            transportType: 'car',
            zoomLevel: ZOOM_SCALE.DEFAULT - 1,
            duration: 8000,
            tilt: 30,
            headingDelta: 15,
        };
    } else if (distance < 300) {
        return {
            transportType: 'plane',
            zoomLevel: 7,
            duration: 5000,
            tilt: 45,
            headingDelta: 30,
        };
    } else if (distance < 500) {
        return {
            transportType: 'plane',
            zoomLevel: 7,
            duration: 6000,
            tilt: 45,
            headingDelta: 30,
        };
    } else if (distance < 1000) {
        return {
            transportType: 'plane',
            zoomLevel: 6,
            duration: 7000,
            tilt: 45,
            headingDelta: 30,
        };
    } else if (distance < 7000) {
        return {
            transportType: 'plane',
            zoomLevel: 4,
            duration: 7000,
            tilt: 45,
            headingDelta: 30,
        };
    } else {
        return {
            transportType: 'plane',
            zoomLevel: 4,
            duration: 8000,
            tilt: 45,
            headingDelta: 30,
        };
    }
};
