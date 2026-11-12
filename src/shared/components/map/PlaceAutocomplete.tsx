import { useEffect, useRef } from 'react';

import { css } from '@emotion/react';

import { Location } from '@/shared/types/map';

interface PlaceAutocompleteProps {
    placeholder?: string;
    language?: string;
    className?: string;
    onPlaceSelect: (location: Location) => void;
    onError?: (error: unknown) => void;
}

const PlaceAutocomplete = ({
    placeholder,
    language = 'ko',
    className,
    onPlaceSelect,
    onError,
}: PlaceAutocompleteProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const onPlaceSelectRef = useRef(onPlaceSelect);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onPlaceSelectRef.current = onPlaceSelect;
        onErrorRef.current = onError;
    });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let autocompleteElement: google.maps.places.PlaceAutocompleteElement | null = null;
        let isUnmounted = false;

        const reportError = (error: unknown) => {
            console.error('Place autocomplete failed', error);
            onErrorRef.current?.(error);
        };

        const handleSelect = async ({ placePrediction }: google.maps.places.PlacePredictionSelectEvent) => {
            try {
                const place = placePrediction.toPlace();
                await place.fetchFields({ fields: ['location'] });
                if (!place.location || isUnmounted) return;
                onPlaceSelectRef.current({ latitude: place.location.lat(), longitude: place.location.lng() });
            } catch (error) {
                reportError(error);
            }
        };

        const mountAutocomplete = async () => {
            const { PlaceAutocompleteElement } = (await google.maps.importLibrary(
                'places',
            )) as google.maps.PlacesLibrary;
            if (isUnmounted) return;

            autocompleteElement = new PlaceAutocompleteElement({
                placeholder,
                requestedLanguage: language,
                noInputIcon: true,
            });
            autocompleteElement.addEventListener('gmp-select', handleSelect);
            autocompleteElement.addEventListener('gmp-error', reportError);
            container.appendChild(autocompleteElement);
        };

        mountAutocomplete().catch(reportError);

        return () => {
            isUnmounted = true;
            autocompleteElement?.removeEventListener('gmp-select', handleSelect);
            autocompleteElement?.removeEventListener('gmp-error', reportError);
            autocompleteElement?.remove();
        };
    }, [placeholder, language]);

    return <div ref={containerRef} css={containerStyle} className={className} />;
};

const containerStyle = css`
    & > gmp-place-autocomplete {
        width: 100%;
        color-scheme: light;
    }
`;

export default PlaceAutocomplete;
