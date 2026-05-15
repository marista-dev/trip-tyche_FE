import { MAP } from '@/shared/constants/ui';
import { Location } from '@/shared/types/map';

/**
 * 포토카드 위치 변경을 위한 오프셋 계산
 * @param height 변경할 높이
 * @returns 계산된 오프셋
 */
export const getPixelPositionOffset = (height: number) => {
    const offset = {
        x: -MAP.PHOTO_CARD_SIZE.WIDTH / 2,
        y: -(MAP.PHOTO_CARD_SIZE.HEIGHT + height),
    };

    return offset;
};

const addressCache = new Map();
/**
 * 주소 변환 성공 여부에 따라 Result 패턴 적용
 * @param latitude 위도
 * @param longitude 경도
 * @returns Result 패턴이 적용된 주소
 */
export const getAddressFromLocation = async (location: Location): Promise<string> => {
    const { latitude, longitude } = location;
    const cacheKey = `${latitude}-${longitude}`;

    if (cacheKey === '0-0') return '';

    if (addressCache.has(cacheKey)) {
        return addressCache.get(cacheKey)!;
    }

    const address = await convertLocationToAddress(latitude, longitude);
    addressCache.set(cacheKey, address);
    return address;
};

/**
 * 지리 좌표(latitude, longitude)를 기준으로 주소 반환
 * @param latitude 위도
 * @param longitude 경도
 * @returns 주소 (실패시 빈 문자열)
 */
const convertLocationToAddress = async (latitude: number, longitude: number): Promise<string> => {
    try {
        const geocoder = new google.maps.Geocoder();

        const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
            geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (result, status) => {
                if (status === 'OK' && result) {
                    resolve(result);
                } else {
                    reject(new Error(`Geocoding failed: ${status}`));
                }
            });
        });

        const CITY_INDEX = result.length - 2;
        return CITY_INDEX >= 0 ? result[CITY_INDEX].formatted_address : '주소 특정 불가 지역';
    } catch (error) {
        console.error(error);
        return '위치 정보 없음';
    }
};

// 건물/POI 단위 정밀 역지오코딩
// 1) Places nearbySearch(radius=30m) → 명명된 POI/건물 우선
// 2) 폴백: Geocoder 결과 중 premise/subpremise/street_address 우선
export const getPreciseLocationFromCoordinate = async (location: Location): Promise<string> => {
    const { latitude, longitude } = location;
    const cacheKey = `precise-${latitude}-${longitude}`;

    if (latitude === 0 && longitude === 0) return '';
    if (addressCache.has(cacheKey)) return addressCache.get(cacheKey)!;

    const center = { lat: latitude, lng: longitude };

    // 1) Places API — 30m 반경 안의 명명된 장소(건물/POI) 우선
    try {
        const placesLib = (google.maps as unknown as { places?: typeof google.maps.places }).places;
        if (placesLib) {
            const service = new placesLib.PlacesService(document.createElement('div'));
            const placeName = await new Promise<string | null>((resolve) => {
                service.nearbySearch({ location: center, radius: 30 }, (results, status) => {
                    if (status !== placesLib.PlacesServiceStatus.OK || !results || results.length === 0) {
                        resolve(null);
                        return;
                    }
                    const POI_TYPES = [
                        'tourist_attraction',
                        'point_of_interest',
                        'museum',
                        'park',
                        'place_of_worship',
                        'church',
                        'landmark',
                        'establishment',
                    ];
                    const preferred =
                        results.find(
                            (r) =>
                                r.name &&
                                r.types?.some((t) => POI_TYPES.includes(t)) &&
                                r.business_status !== 'CLOSED_PERMANENTLY',
                        ) ??
                        results.find((r) => r.name && r.business_status !== 'CLOSED_PERMANENTLY') ??
                        results[0];
                    resolve(preferred?.name ?? null);
                });
            });

            if (placeName) {
                addressCache.set(cacheKey, placeName);
                return placeName;
            }
        }
    } catch (e) {
        console.warn('Places API lookup failed', e);
    }

    // 2) Geocoder fallback — 가장 정밀한 result.formatted_address
    try {
        const geocoder = new google.maps.Geocoder();
        const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
            geocoder.geocode({ location: center }, (r, s) => {
                s === 'OK' && r ? resolve(r) : reject(new Error(`Geocoding failed: ${s}`));
            });
        });

        const PRECISION_TYPES = [
            'premise',
            'subpremise',
            'street_address',
            'route',
            'sublocality_level_4',
            'sublocality_level_3',
            'sublocality_level_2',
            'sublocality_level_1',
            'neighborhood',
        ];
        let best: google.maps.GeocoderResult | undefined;
        for (const type of PRECISION_TYPES) {
            best = results.find((r) => r.types.includes(type));
            if (best) break;
        }
        const picked = best ?? results[0];
        if (!picked) {
            const fb = '주소 특정 불가';
            addressCache.set(cacheKey, fb);
            return fb;
        }

        const cleaned = picked.formatted_address
            .replace(/^대한민국[\s,]*/, '')
            .replace(/^South Korea[\s,]*/, '')
            .replace(/^일본[\s,]*/, '')
            .replace(/^Japan[\s,]*/, '')
            .replace(/〒\d{3}-?\d{4}\s*/, '')
            .replace(/,?\s*\d{5,}\s*$/, '')
            .trim();

        addressCache.set(cacheKey, cleaned);
        return cleaned;
    } catch {
        return '위치 정보 없음';
    }
};

// 0.5km 단위 분간이 가능한 동네/소구역 수준 역지오코딩
export const getNeighborhoodFromLocation = async (location: Location): Promise<string> => {
    const { latitude, longitude } = location;
    const cacheKey = `nbhd-${latitude}-${longitude}`;

    if (latitude === 0 && longitude === 0) return '';
    if (addressCache.has(cacheKey)) return addressCache.get(cacheKey)!;

    try {
        const geocoder = new google.maps.Geocoder();
        const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
            geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (r, s) => {
                s === 'OK' && r ? resolve(r) : reject(new Error(`Geocoding failed: ${s}`));
            });
        });

        // 우선순위: 소구역2 > 소구역1 > 동네 > 도로명
        for (const type of ['sublocality_level_2', 'sublocality_level_1', 'neighborhood', 'route']) {
            for (const result of results) {
                const comp = result.address_components.find((c) => c.types.includes(type));
                if (comp) {
                    addressCache.set(cacheKey, comp.long_name);
                    return comp.long_name;
                }
            }
        }

        const fallback = results[0]?.formatted_address ?? '주소 특정 불가 지역';
        addressCache.set(cacheKey, fallback);
        return fallback;
    } catch {
        return '위치 정보 없음';
    }
};
