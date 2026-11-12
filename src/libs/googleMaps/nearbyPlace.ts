import { LatLng } from '@/shared/types/map';

const SEARCH_RADIUS_METERS = 30;
const MAX_CANDIDATES = 10;

const LANDMARK_TYPES = new Set([
    'tourist_attraction',
    'historical_landmark',
    'cultural_landmark',
    'landmark',
    'monument',
    'museum',
    'art_gallery',
    'park',
    'national_park',
    'garden',
    'amusement_park',
    'zoo',
    'aquarium',
    'observation_deck',
    'castle',
    'place_of_worship',
    'church',
    'buddhist_temple',
    'shinto_shrine',
    'hindu_temple',
    'mosque',
    'synagogue',
]);

const ADDRESS_ONLY_TYPES = new Set(['premise', 'subpremise', 'street_address']);

const isOpenNamedPlace = (place: google.maps.places.Place) =>
    !!place.displayName && place.businessStatus !== 'CLOSED_PERMANENTLY';

const isLandmark = (place: google.maps.places.Place) => !!place.types?.some((type) => LANDMARK_TYPES.has(type));

const isAddressOnly = (place: google.maps.places.Place) => !!place.types?.some((type) => ADDRESS_ONLY_TYPES.has(type));

export const findNearbyPlaceName = async (center: LatLng): Promise<string | null> => {
    const { Place, SearchNearbyRankPreference } = (await google.maps.importLibrary(
        'places',
    )) as google.maps.PlacesLibrary;

    const { places } = await Place.searchNearby({
        fields: ['displayName', 'types', 'businessStatus'],
        locationRestriction: { center, radius: SEARCH_RADIUS_METERS },
        // POPULARITY mirrors the legacy prominence ranking; DISTANCE surfaces parking lots and booths first.
        rankPreference: SearchNearbyRankPreference.POPULARITY,
        maxResultCount: MAX_CANDIDATES,
        language: 'ko',
    });

    const candidates = places.filter(isOpenNamedPlace);
    const bestMatch = candidates.find(isLandmark) ?? candidates.find((place) => !isAddressOnly(place));

    return bestMatch?.displayName ?? null;
};
