import { reverseGeocode } from '@/libs/googleMaps/reverseGeocode';
import { LatLng } from '@/shared/types/map';

const ADDRESS_TYPES_BY_PRECISION = [
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

const UNRESOLVED_ADDRESS = '주소 특정 불가';

const findMostPreciseResult = (results: google.maps.GeocoderResult[]) => {
    for (const addressType of ADDRESS_TYPES_BY_PRECISION) {
        const match = results.find((result) => result.types.includes(addressType));
        if (match) return match;
    }
    return results[0];
};

const stripCountryAndPostalCode = (formattedAddress: string) =>
    formattedAddress
        .replace(/^(대한민국|South Korea|일본|Japan)[\s,]*/, '')
        .replace(/〒\d{3}-?\d{4}\s*/, '')
        .replace(/,?\s*\d{5,}\s*$/, '')
        .trim();

export const findPreciseAddress = async (latLng: LatLng): Promise<string> => {
    const mostPreciseResult = findMostPreciseResult(await reverseGeocode(latLng));
    return mostPreciseResult ? stripCountryAndPostalCode(mostPreciseResult.formatted_address) : UNRESOLVED_ADDRESS;
};
