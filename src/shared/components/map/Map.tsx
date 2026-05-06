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

    return (
        <div css={map}>
            <GoogleMap
                zoom={zoom}
                center={{ lat: latitude, lng: longitude }}
                options={{
                    ...MAPS_OPTIONS,
                    ...mapIdOption,
                    draggable: isInteractive,
                    scrollwheel: isInteractive,
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
