import { useEffect, useMemo, useRef, useState } from 'react';

import { css } from '@emotion/react';
import { MapContext } from '@react-google-maps/api';

import { acquireMap, releaseMap, withoutMapId } from '@/shared/components/map/mapPool';
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

const buildOptions = (isInteractive: boolean): google.maps.MapOptions => ({
    ...MAPS_OPTIONS,
    // mapId가 있을 때만 전달 — 빈 문자열이면 에러 발생
    ...(GOOGLE_MAPS_MAP_ID ? { mapId: GOOGLE_MAPS_MAP_ID } : {}),
    draggable: isInteractive,
    scrollwheel: isInteractive,
    // greedy: 한 손가락 팬/핀치 줌 모두 허용. none: 모든 제스처 차단.
    gestureHandling: isInteractive ? 'greedy' : 'none',
    tiltInteractionEnabled: !!GOOGLE_MAPS_MAP_ID,
    headingInteractionEnabled: !!GOOGLE_MAPS_MAP_ID,
});

/**
 * 지도 인스턴스를 새로 만들지 않고 mapPool에서 빌려 쓴다(이유는 mapPool.ts 참고).
 * 자식은 @react-google-maps/api의 MapContext로 지도를 받으므로 useGoogleMap·Marker·OverlayView가 그대로 동작한다.
 * zoom·center는 <GoogleMap>과 같이 값이 바뀔 때만 지도에 적용한다.
 */
const Map = ({ zoom, center, children, isInteractive = true, onLoad, onZoomChanged, onClick }: MapProps) => {
    const { latitude, longitude } = center;
    const containerRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const options = useMemo(() => buildOptions(isInteractive), [isInteractive]);

    // 지도를 빌리는 effect는 마운트 때 한 번만 돈다. 그때의 최신 값을 ref로 읽는다
    const initial = useRef({ zoom, latitude, longitude, options, onLoad });
    initial.current = { zoom, latitude, longitude, options, onLoad };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const { zoom: z, latitude: lat, longitude: lng, options: opts, onLoad: load } = initial.current;
        const pooled = acquireMap({ ...opts, zoom: z, center: { lat, lng } });
        container.appendChild(pooled.element);
        setMap(pooled.map);
        load(pooled.map);
        return () => {
            setMap(null);
            releaseMap(pooled);
        };
    }, []);

    useEffect(() => {
        if (!map) return;
        map.setOptions(withoutMapId(options));
    }, [map, options]);

    // 첫 적용은 acquireMap이 했으므로 이후 값이 바뀔 때만 적용한다
    const applied = useRef<{ map: google.maps.Map | null; zoom: number; lat: number; lng: number } | null>(null);
    useEffect(() => {
        if (!map) return;
        const prev = applied.current;
        applied.current = { map, zoom, lat: latitude, lng: longitude };
        if (!prev || prev.map !== map) return;
        if (prev.zoom !== zoom) map.setZoom(zoom);
        if (prev.lat !== latitude || prev.lng !== longitude) map.setCenter({ lat: latitude, lng: longitude });
    }, [map, zoom, latitude, longitude]);

    useEffect(() => {
        if (!map || !onZoomChanged) return;
        const listener = map.addListener('zoom_changed', onZoomChanged);
        return () => listener.remove();
    }, [map, onZoomChanged]);

    useEffect(() => {
        if (!map || !onClick) return;
        const listener = map.addListener('click', onClick);
        return () => listener.remove();
    }, [map, onClick]);

    return (
        <div css={wrapper}>
            <div ref={containerRef} css={mapContainer} />
            {map && <MapContext.Provider value={map}>{children}</MapContext.Provider>}
        </div>
    );
};

const wrapper = css`
    height: 100%;
`;

// 하단 Google 로고·약관 줄을 화면 밖으로 밀어낸다(기존 mapContainerStyle과 같다)
const mapContainer = css`
    height: calc(100% + 30px);
`;

export default Map;
