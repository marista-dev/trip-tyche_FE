import { MutableRefObject, useState } from 'react';

import { css, keyframes } from '@emotion/react';
import { Marker as GoogleMapsMarker, OverlayView } from '@react-google-maps/api';

import { hasValidLocation } from '@/libs/utils/validate';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import Map from '@/shared/components/map/Map';
import { DEFAULT_CENTER, ZOOM_SCALE } from '@/shared/constants/map';
import { Location, MapType } from '@/shared/types/map';

interface MultiMarkerMapProps {
    positions: Location[];
    activeIndex: number;
    mapRef: MutableRefObject<MapType | null>;
    mapHeight?: string;
}

const INACTIVE_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
  <defs>
    <radialGradient id="dot" cx="35%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#404040"/>
      <stop offset="100%" stop-color="#0a0a0a"/>
    </radialGradient>
  </defs>
  <circle cx="10" cy="10" r="9" fill="rgba(0,0,0,0.18)"/>
  <circle cx="10" cy="10" r="6" fill="url(#dot)" stroke="#ffffff" stroke-width="1.8"/>
</svg>
`).replace(/\n/g, '');

const INACTIVE_ICON_URL = `data:image/svg+xml;charset=UTF-8,${INACTIVE_SVG}`;

const MultiMarkerMap = ({ positions, activeIndex, mapRef, mapHeight = '200px' }: MultiMarkerMapProps) => {
    const [isMapRendered, setIsMapRendered] = useState(false);

    const validPositions = positions.filter(hasValidLocation);
    const activePosition = validPositions[Math.min(activeIndex, Math.max(validPositions.length - 1, 0))];

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

        const target = validPositions[Math.min(activeIndex, validPositions.length - 1)] ?? validPositions[0];
        map.setCenter({ lat: target.latitude, lng: target.longitude });
        map.setZoom(17);

        setIsMapRendered(true);
    };

    const inactiveIcon = (() => {
        if (typeof window === 'undefined' || !window.google?.maps) return undefined;
        return {
            url: INACTIVE_ICON_URL,
            scaledSize: new window.google.maps.Size(20, 20),
            anchor: new window.google.maps.Point(10, 10),
        };
    })();

    return (
        <div css={container(mapHeight)}>
            {!isMapRendered && <Indicator />}
            <Map zoom={ZOOM_SCALE.DEFAULT} center={initialCenter} onLoad={handleLoad} isInteractive={false}>
                {isMapRendered &&
                    validPositions.map((pos, i) => {
                        if (i === activeIndex) return null;
                        return (
                            <GoogleMapsMarker
                                key={i}
                                position={{ lat: pos.latitude, lng: pos.longitude }}
                                icon={inactiveIcon}
                                zIndex={10 + i}
                                clickable={false}
                            />
                        );
                    })}
                {isMapRendered && activePosition && (
                    <OverlayView
                        position={{ lat: activePosition.latitude, lng: activePosition.longitude }}
                        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                        getPixelPositionOffset={(width, height) => ({ x: -width / 2, y: -height / 2 })}
                    >
                        <div css={pulseWrap}>
                            <span css={pulseRing(0)} />
                            <span css={pulseRing(0.9)} />
                            <span css={pulseDot} />
                        </div>
                    </OverlayView>
                )}
            </Map>
            <div css={topVignette} />
        </div>
    );
};

const container = (height: string) => css`
    height: ${height};
    position: relative;
    overflow: hidden;
`;

const topVignette = css`
    position: absolute;
    inset: 0 0 auto 0;
    height: 80px;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0));
    pointer-events: none;
`;

const pinPulse = keyframes`
    0%   { transform: scale(0.8); opacity: 0.65; }
    100% { transform: scale(2.6); opacity: 0; }
`;

const pulseWrap = css`
    position: relative;
    width: 56px;
    height: 56px;
    display: grid;
    place-items: center;
    pointer-events: none;
`;

const pulseRing = (delaySeconds: number) => css`
    position: absolute;
    inset: 0;
    border: 1.5px solid #0ea5e9;
    border-radius: 50%;
    opacity: 0;
    animation: ${pinPulse} 1.8s linear infinite;
    animation-delay: -${delaySeconds}s;
    will-change: transform, opacity;
`;

const pulseDot = css`
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #0ea5e9;
    border: 2px solid #fff;
    box-shadow:
        0 0 0 1px rgba(14, 165, 233, 0.35),
        0 4px 10px -2px rgba(14, 165, 233, 0.55);
`;

export default MultiMarkerMap;
