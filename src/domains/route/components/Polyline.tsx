import { useMemo } from 'react';

import { Polyline as GoogleMapsPolyline } from '@react-google-maps/api';

import { PinPoint } from '@/domains/route/types';
import { COLORS } from '@/shared/constants/style';
import { Location, PolylineOption } from '@/shared/types/map';

interface PolylineProps {
    pinPoints: PinPoint[];
    isCharacterVisible?: boolean;
    /** 현재 캐릭터가 위치한 핀포인트 인덱스 */
    currentPinPointIndex?: number;
    /** 현재 캐릭터의 실시간 위치 (이동 중 경로 분할에 사용) */
    characterPosition?: Location | null;
}

const dotLineIcons = (color: string): google.maps.IconSequence[] => [
    {
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: color,
            fillOpacity: 1,
            strokeWeight: 0,
            scale: 2,
        },
        offset: '0',
        repeat: '12px',
    },
];

const Polyline = ({
    pinPoints,
    isCharacterVisible = true,
    currentPinPointIndex = 0,
    characterPosition,
}: PolylineProps) => {
    const allCoords = useMemo(
        () => pinPoints.map((p) => ({ lat: p.latitude, lng: p.longitude })),
        [pinPoints],
    );

    // 지나간 경로: pinPoints[0] … pinPoints[currentPinPointIndex] + 현재 캐릭터 위치
    const completedPath = useMemo(() => {
        const base = allCoords.slice(0, currentPinPointIndex + 1);
        if (characterPosition) {
            const charCoord = { lat: characterPosition.latitude, lng: characterPosition.longitude };
            const last = base[base.length - 1];
            if (last.lat !== charCoord.lat || last.lng !== charCoord.lng) {
                return [...base, charCoord];
            }
        }
        return base;
    }, [allCoords, currentPinPointIndex, characterPosition]);

    // 남은 경로: 현재 캐릭터 위치 … pinPoints[마지막]
    const remainingPath = useMemo(() => {
        const rest = allCoords.slice(currentPinPointIndex + 1);
        if (characterPosition && rest.length > 0) {
            return [{ lat: characterPosition.latitude, lng: characterPosition.longitude }, ...rest];
        }
        return rest;
    }, [allCoords, currentPinPointIndex, characterPosition]);

    if (pinPoints.length <= 1) return null;

    if (!isCharacterVisible) {
        // 줌아웃 상태: 단순 점선 전체 경로
        const opts: PolylineOption = {
            strokeOpacity: 0,
            strokeWeight: 2,
            icons: dotLineIcons(COLORS.TEXT.DESCRIPTION_LIGHT),
        };
        return <GoogleMapsPolyline path={allCoords} options={opts} />;
    }

    const completedOpts: PolylineOption = {
        strokeColor: COLORS.PRIMARY,
        strokeOpacity: 0.85,
        strokeWeight: 3.5,
    };

    const remainingOpts: PolylineOption = {
        strokeOpacity: 0,
        strokeWeight: 2,
        icons: dotLineIcons('#94a3b8'),
    };

    return (
        <>
            {completedPath.length > 1 && (
                <GoogleMapsPolyline path={completedPath} options={completedOpts} />
            )}
            {remainingPath.length > 1 && (
                <GoogleMapsPolyline path={remainingPath} options={remainingOpts} />
            )}
        </>
    );
};

export default Polyline;
