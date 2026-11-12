import { isUnknownLocation, memoizeByLocation } from '@/libs/googleMaps/locationCache';
import { findNearbyPlaceName } from '@/libs/googleMaps/nearbyPlace';
import { findPreciseAddress } from '@/libs/googleMaps/preciseAddress';
import { Location } from '@/shared/types/map';

const resolvePreciseLocation = async ({ latitude, longitude }: Location): Promise<string> => {
    const latLng = { lat: latitude, lng: longitude };

    const nearbyPlaceName = await findNearbyPlaceName(latLng).catch((error) => {
        console.warn('Nearby place lookup failed', error);
        return null;
    });

    return nearbyPlaceName ?? findPreciseAddress(latLng);
};

const resolvePreciseLocationCached = memoizeByLocation(resolvePreciseLocation);

export const getPreciseLocationFromCoordinate = async (location: Location): Promise<string> => {
    if (isUnknownLocation(location)) return '';

    try {
        return await resolvePreciseLocationCached(location);
    } catch (error) {
        console.error('역지오코딩 실패: ', error);
        return '위치 정보 없음';
    }
};
