import { useMemo } from 'react';

import { css } from '@emotion/react';
import { GoogleMap } from '@react-google-maps/api';

import { GOOGLE_MAPS_MAP_ID, MAPS_OPTIONS } from '@/shared/constants/map';
import { Location, MapType } from '@/shared/types/map';

interface MapProps {
    zoom: number;
    center: Location;
    children: React.ReactNode;
    isInteractive?: boolean;
    onLoad: (map: MapType) => void;
    onZoomChanged?: () => void;
    onClick?: (event?: google.maps.MapMouseEvent) => void;
}

const Map = ({ zoom, center, children, isInteractive = true, onLoad, onZoomChanged, onClick }: MapProps) => {
    const { latitude, longitude } = center;

    // mapId가 있을 때만 전달 — 빈 문자열이면 에러 발생
    const mapIdOption = GOOGLE_MAPS_MAP_ID ? { mapId: GOOGLE_MAPS_MAP_ID } : {};

    // center 객체 reference 안정화 — lat/lng 값이 동일할 때 같은 ref 유지
    // (안 그러면 @react-google-maps/api가 매 렌더마다 map.panTo()로 카메라를 리셋)
    const stableCenter = useMemo(() => ({ lat: latitude, lng: longitude }), [latitude, longitude]);

    return (
        <div css={map}>
            <GoogleMap
                zoom={zoom}
                center={stableCenter}
                options={{
                    ...MAPS_OPTIONS,
                    ...mapIdOption,
                    draggable: isInteractive,
                    scrollwheel: isInteractive,
                    // greedy: 한 손가락 팬/핀치 줌 모두 허용. none: 모든 제스처 차단.
                    gestureHandling: isInteractive ? 'greedy' : 'none',
                    tiltInteractionEnabled: !!GOOGLE_MAPS_MAP_ID,
                    headingInteractionEnabled: !!GOOGLE_MAPS_MAP_ID,
                }}
                mapContainerStyle={{ height: 'calc(100% + 30px)' }}
                onLoad={onLoad}
                onZoomChanged={onZoomChanged}
                onClick={onClick}
            >
                {children}
            </GoogleMap>
        </div>
    );
};

const map = css`
    height: 100%;
`;

export default Map;
