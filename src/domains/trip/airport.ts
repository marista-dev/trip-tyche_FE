import { COUNTRIES } from '@/domains/trip/constants';

export const FALLBACK_IATA = 'TRP';

const iataCache = new Map<string, string>();

export const getIataFromCountryString = (country?: string): string => {
    if (!country) return FALLBACK_IATA;
    const cached = iataCache.get(country);
    if (cached) return cached;
    const iata = COUNTRIES.find((c) => c.value === country)?.iata ?? FALLBACK_IATA;
    iataCache.set(country, iata);
    return iata;
};
