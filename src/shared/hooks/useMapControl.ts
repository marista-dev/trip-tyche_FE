import { useCallback, useEffect, useRef, useState } from 'react';

import { GOOGLE_MAPS_MAP_ID } from '@/shared/constants/map';
import { useMapScript } from '@/shared/hooks/useMapScript';
import { Location, MapType } from '@/shared/types/map';

interface MoveCameraOptions {
    center?: Location;
    zoom?: number;
    tilt?: number;
    heading?: number;
}

export const useMapControl = (initialZoom: number, initialCenter: Location | null) => {
    const { isMapScriptLoaded, isMapScriptLoadError } = useMapScript();

    const [isMapRendered, setIsMapRendered] = useState(false);
    const [zoom, setZoom] = useState(initialZoom);
    const [center, setCenter] = useState(initialCenter);

    const mapRef = useRef<MapType | null>(null);

    useEffect(() => {
        setCenter(initialCenter);
    }, [initialCenter]);

    const handleMapRender = useCallback((map: MapType) => {
        if (map) {
            mapRef.current = map;
            setIsMapRendered(true);
        }
    }, []);

    // 단일 호출로 center/zoom/tilt/heading 동시 변경
    // vector mapId 없이는 moveCamera()가 없을 수 있으므로 feature detection 후 fallback
    const moveCamera = useCallback((options: MoveCameraOptions) => {
        const map = mapRef.current;
        if (!map) return;

        const hasMoveCamera = typeof (map as google.maps.Map).moveCamera === 'function';

        if (hasMoveCamera && GOOGLE_MAPS_MAP_ID) {
            const cameraOptions: google.maps.CameraOptions = {};
            if (options.center !== undefined) {
                cameraOptions.center = { lat: options.center.latitude, lng: options.center.longitude };
            }
            if (options.zoom !== undefined) cameraOptions.zoom = options.zoom;
            if (options.tilt !== undefined) cameraOptions.tilt = options.tilt;
            if (options.heading !== undefined) cameraOptions.heading = options.heading;
            (map as google.maps.Map).moveCamera(cameraOptions);
        } else {
            // raster fallback: moveCamera 미지원 시 개별 메서드 사용
            if (options.center !== undefined) {
                map.panTo({ lat: options.center.latitude, lng: options.center.longitude });
            }
            if (options.zoom !== undefined) map.setZoom(options.zoom);
        }

        // React 상태도 동기화
        if (options.center !== undefined) setCenter(options.center);
        if (options.zoom !== undefined) setZoom(options.zoom);
    }, []);

    const updateMapCenter = useCallback((newCenter: Location) => {
        moveCamera({ center: newCenter });
    }, [moveCamera]);

    return {
        mapRef,
        mapStatus: {
            zoom,
            center,
        },
        isMapScriptLoaded,
        isMapScriptLoadError,
        isMapRendered,
        handleMapRender,
        updateMapCenter,
        moveCamera,
    };
};
