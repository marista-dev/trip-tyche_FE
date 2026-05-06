import { OverlayView, OverlayViewF } from '@react-google-maps/api';
import { css } from '@emotion/react';

import characterImage from '/character.png';
import planeImage from '/plane-icon.png';
import carImage from '/car-icon.png';

import { Location } from '@/shared/types/map';

interface CharacterMarkerProps {
    position: Location;
    isMapRendered: boolean;
    transportType?: string;
    /** 진행 방향 각도 (도, 0 = 북쪽, 시계방향). undefined 이면 회전 없음 */
    bearing?: number;
}

interface MarkerSpec {
    src: string;
    /** 렌더 크기 (CSS px) */
    width: number;
    height: number;
    /** 앵커 오프셋: 이 점이 lat/lng 위치에 정렬됨 */
    anchorX: number;
    anchorY: number;
    /** PNG 기본 방향이 '북쪽'이 아닐 때 bearing 보정값 (도) */
    bearingOffset: number;
}

const MARKER_SPECS: Record<string, MarkerSpec> = {
    walking: {
        src: characterImage,
        width: 45,
        height: 60,
        anchorX: 28,
        anchorY: 50,
        bearingOffset: 0,
    },
    car: {
        src: carImage,
        width: 55,
        height: 50,
        anchorX: 22,
        anchorY: 32,
        bearingOffset: 0,
    },
    plane: {
        src: planeImage,
        width: 45,
        height: 45,
        anchorX: 28,
        anchorY: 28,
        bearingOffset: 0,
    },
};

const CharacterMarker = ({
    position,
    isMapRendered,
    transportType = 'walking',
    bearing,
}: CharacterMarkerProps) => {
    if (!isMapRendered) return null;

    const spec = MARKER_SPECS[transportType] ?? MARKER_SPECS.walking;

    const rotation = (() => {
        if (bearing === undefined) return 0;
        if (transportType === 'walking') {
            // 도보 캐릭터: 좌우 반전만 (atan2 bearing 기준 동쪽 방향이 0°에 가까우면 오른쪽)
            // bearing 0=북, 90=동, 180=남, 270(=-90)=서
            // 서쪽 방향일 때 반전 (scaleX(-1))을 아래 imgStyle에서 처리
            return 0;
        }
        return bearing + spec.bearingOffset;
    })();

    // 도보 캐릭터는 좌우 반전으로만 방향 표현
    const isFlipped = transportType === 'walking' && bearing !== undefined && (bearing > 90 && bearing <= 270);

    return (
        <OverlayViewF
            position={{ lat: position.latitude, lng: position.longitude }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            getPixelPositionOffset={() => ({ x: -spec.anchorX, y: -spec.anchorY })}
        >
            <img
                src={spec.src}
                alt=""
                css={imgStyle(spec.width, spec.height, spec.anchorX, spec.anchorY, rotation, isFlipped)}
                draggable={false}
            />
        </OverlayViewF>
    );
};

const imgStyle = (
    width: number,
    height: number,
    anchorX: number,
    anchorY: number,
    rotation: number,
    isFlipped: boolean,
) => css`
    width: ${width}px;
    height: ${height}px;
    display: block;
    pointer-events: none;
    user-select: none;
    transform-origin: ${anchorX}px ${anchorY}px;
    transform: rotate(${rotation}deg) ${isFlipped ? 'scaleX(-1)' : ''};
    transition: transform 0.12s linear;
`;

export default CharacterMarker;
