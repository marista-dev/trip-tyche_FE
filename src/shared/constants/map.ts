import { Libraries } from '@react-google-maps/api';

import { MapOption } from '@/shared/types/map';

// Google Maps API Key
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Vector mapId — 비어 있으면 raster 맵 fallback (3D 빌딩·tilt 비활성)
export const GOOGLE_MAPS_MAP_ID: string | undefined =
    import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || undefined;

// Goole Maps 로드를 위한 환경 설정
export const GOOGLE_MAPS_CONFIG = {
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'] as Libraries,
    language: 'ko',
    region: 'KR',
} as const;

// 기본 지도 옵션
export const MAPS_OPTIONS: MapOption = {
    minZoom: 3,
    maxZoom: 19,
    disableDefaultUI: true,
    mapTypeControl: false,
    fullscreenControl: false,
    zoomControl: false,
    streetViewControl: false,
    rotateControl: false,
    clickableIcons: false,
} as const;

// 지도 기본 중심 좌표(center)
export const DEFAULT_CENTER = {
    latitude: 37.5,
    longitude: 127,
} as const;

// 지도 줌레벨(zoom)
export const ZOOM_SCALE = {
    LOCATION_ADD: 12,
    IMAGE_BY_DATE: 13,
    UNLOCATION: 3,
    DEFAULT: 14,
    INDIVIDUAL_IMAGE_MARKERS_VISIBLE: 15,
};
