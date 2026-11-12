import { Location } from '@/shared/types/map';

export const isUnknownLocation = ({ latitude, longitude }: Location) => latitude === 0 && longitude === 0;

export const memoizeByLocation = (lookup: (location: Location) => Promise<string>) => {
    const resolvedByCoordinate = new Map<string, string>();

    return async (location: Location): Promise<string> => {
        const coordinateKey = `${location.latitude},${location.longitude}`;
        const cached = resolvedByCoordinate.get(coordinateKey);
        if (cached !== undefined) return cached;

        const resolved = await lookup(location);
        resolvedByCoordinate.set(coordinateKey, resolved);
        return resolved;
    };
};
