import { useRef } from 'react';

import { css } from '@emotion/react';
import { Autocomplete } from '@react-google-maps/api';
import { ChevronLeft } from 'lucide-react';

import { COLORS } from '@/shared/constants/style';
import { PlacesAutocomplete } from '@/shared/types/map';

interface SearchPlaceInputProps {
    isMapScriptLoaded: boolean;
    isBackButtonDisable: boolean;
    onLocationChange: (latitude: number, longitude: number) => void;
    onBack: () => void;
}

const SearchPlaceInput = ({
    isMapScriptLoaded,
    isBackButtonDisable,
    onLocationChange,
    onBack,
}: SearchPlaceInputProps) => {
    const autocompleteRef = useRef<PlacesAutocomplete>(null);

    const handlePlaceChange = () => {
        if (autocompleteRef.current !== null) {
            const place = autocompleteRef.current.getPlace();

            if (place.geometry && place.geometry.location) {
                const latitude = place.geometry.location.lat();
                const longitude = place.geometry.location.lng();

                onLocationChange?.(latitude, longitude);
            }
        }
    };

    if (!isMapScriptLoaded) return;

    return (
        <div css={container}>
            <button css={backButtonStyle} onClick={onBack} disabled={isBackButtonDisable}>
                <ChevronLeft size={24} strokeWidth={2.2} color={`${COLORS.TEXT.DESCRIPTION}`} />
            </button>

            <Autocomplete
                onLoad={(autocomplete) => (autocompleteRef.current = autocomplete)}
                onPlaceChanged={handlePlaceChange}
                css={inputWrapper}
            >
                <input type='text' placeholder='장소를 검색해주세요' css={inputStyle} />
            </Autocomplete>
        </div>
    );
};

const container = css`
    width: calc(100% - 32px);
    max-width: 428px;
    height: 54px;
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 1;
    display: flex;
    background-color: ${COLORS.BACKGROUND.WHITE};
    border-radius: 10px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    overflow: hidden;
`;

const backButtonStyle = css`
    width: 54px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    border: 0;
    cursor: pointer;

    &:hover {
        background-color: ${COLORS.BACKGROUND.GRAY_LIGHT};
    }
`;

const inputWrapper = css`
    width: 100%;
`;

const inputStyle = css`
    width: 100%;
    height: 100%;
    padding: 0 20px 0 12px;
    border: 0;
`;

export default SearchPlaceInput;
