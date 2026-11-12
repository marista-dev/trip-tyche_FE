import { isUnknownLocation, memoizeByLocation } from '@/libs/googleMaps/locationCache';
import { reverseGeocode } from '@/libs/googleMaps/reverseGeocode';
import { MAP } from '@/shared/constants/ui';
import { Location } from '@/shared/types/map';

export { getPreciseLocationFromCoordinate } from '@/libs/googleMaps/preciseLocation';

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

const toLatLng = ({ latitude, longitude }: Location) => ({ lat: latitude, lng: longitude });

const resolveCityAddress = async (location: Location): Promise<string> => {
    try {
        const results = await reverseGeocode(toLatLng(location));
        const cityIndex = results.length - 2;
        return cityIndex >= 0 ? results[cityIndex].formatted_address : '주소 특정 불가 지역';
    } catch (error) {
        console.error(error);
        return '위치 정보 없음';
    }
};

const resolveCityAddressCached = memoizeByLocation(resolveCityAddress);

/**
 * 좌표의 도시 단위 주소 (실패 시 안내 문구)
 */
export const getAddressFromLocation = async (location: Location): Promise<string> =>
    isUnknownLocation(location) ? '' : resolveCityAddressCached(location);

const NEIGHBORHOOD_TYPES_BY_PRIORITY = ['sublocality_level_2', 'sublocality_level_1', 'neighborhood', 'route'];

const resolveNeighborhood = async (location: Location): Promise<string> => {
    const results = await reverseGeocode(toLatLng(location));

    for (const neighborhoodType of NEIGHBORHOOD_TYPES_BY_PRIORITY) {
        for (const result of results) {
            const component = result.address_components.find((c) => c.types.includes(neighborhoodType));
            if (component) return component.long_name;
        }
    }

    return results[0]?.formatted_address ?? '주소 특정 불가 지역';
};

const resolveNeighborhoodCached = memoizeByLocation(resolveNeighborhood);

/**
 * 0.5km 단위 분간이 가능한 동네/소구역 수준 주소
 */
export const getNeighborhoodFromLocation = async (location: Location): Promise<string> => {
    if (isUnknownLocation(location)) return '';

    try {
        return await resolveNeighborhoodCached(location);
    } catch (error) {
        console.error('역지오코딩 실패: ', error);
        return '위치 정보 없음';
    }
};
