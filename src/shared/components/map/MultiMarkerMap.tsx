import { MutableRefObject, useState } from 'react';

import { css } from '@emotion/react';

import { hasValidLocation } from '@/libs/utils/validate';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import Map from '@/shared/components/map/Map';
import Marker from '@/shared/components/map/Marker';
import { DEFAULT_CENTER, ZOOM_SCALE } from '@/shared/constants/map';
import { Location, MapType } from '@/shared/types/map';

interface MultiMarkerMapProps {
    positions: Location[];
    activeIndex: number;
    mapRef: MutableRefObject<MapType | null>;
    mapHeight?: string;
}

const MultiMarkerMap = ({ positions, activeIndex, mapRef, mapHeight = '200px' }: MultiMarkerMapProps) => {
    const [isMapRendered, setIsMapRendered] = useState(false);

    const validPositions = positions.filter(hasValidLocation);

    const initialCenter = (() => {
        if (validPositions.length > 0) {
            return { latitude: validPositions[0].latitude, longitude: validPositions[0].longitude };
        }
        return DEFAULT_CENTER;
    })();

    const handleLoad = (map: MapType) => {
        mapRef.current = map;

        if (validPositions.length === 0) {
            setIsMapRendered(true);
            return;
        }

        if (validPositions.length === 1) {
            map.setCenter({ lat: validPositions[0].latitude, lng: validPositions[0].longitude });
            map.setZoom(ZOOM_SCALE.DEFAULT);
        } else {
            const bounds = new google.maps.LatLngBounds();
            validPositions.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }));
            map.fitBounds(bounds, 24);
        }

        setIsMapRendered(true);
    };

    return (
        <div css={container(mapHeight)}>
            {!isMapRendered && <Indicator />}
            <Map zoom={ZOOM_SCALE.DEFAULT} center={initialCenter} onLoad={handleLoad} isInteractive={false}>
                {validPositions.map((pos, i) => (
                    <Marker
                        key={i}
                        position={pos}
                        isMapRendered={isMapRendered}
                        isClick={i === activeIndex}
                        isIndividualImageMarker={i !== activeIndex}
                    />
                ))}
            </Map>
        </div>
    );
};

const container = (height: string) => css`
    height: ${height};
    overflow: hidden;
`;

export default MultiMarkerMap;
