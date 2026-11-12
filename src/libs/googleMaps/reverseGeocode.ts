import { LatLng } from '@/shared/types/map';

export const reverseGeocode = async (latLng: LatLng): Promise<google.maps.GeocoderResult[]> => {
    const { results } = await new google.maps.Geocoder().geocode({ location: latLng });
    return results;
};
