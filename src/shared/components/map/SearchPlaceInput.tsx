import { css } from '@emotion/react';
import { ChevronLeft } from 'lucide-react';

import PlaceAutocomplete from '@/shared/components/map/PlaceAutocomplete';
import { COLORS } from '@/shared/constants/style';
import { useToastStore } from '@/shared/stores/useToastStore';
import { Location } from '@/shared/types/map';

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
    const { showToast } = useToastStore();

    const handlePlaceSelect = ({ latitude, longitude }: Location) => onLocationChange(latitude, longitude);

    if (!isMapScriptLoaded) return;

    return (
        <div css={container}>
            <button css={backButtonStyle} onClick={onBack} disabled={isBackButtonDisable}>
                <ChevronLeft size={24} strokeWidth={2.2} color={`${COLORS.TEXT.DESCRIPTION}`} />
            </button>

            <PlaceAutocomplete
                placeholder='장소를 검색해주세요'
                css={autocompleteStyle}
                onPlaceSelect={handlePlaceSelect}
                onError={() => showToast('장소 검색에 실패했어요. 잠시 후 다시 시도해주세요')}
            />
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
`;

const backButtonStyle = css`
    width: 54px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    border: 0;
    border-radius: 10px 0 0 10px;
    cursor: pointer;

    &:hover {
        background-color: ${COLORS.BACKGROUND.GRAY_LIGHT};
    }
`;

const autocompleteStyle = css`
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;

    & > gmp-place-autocomplete {
        background-color: ${COLORS.BACKGROUND.WHITE};
        border: 0;
        border-radius: 0 10px 10px 0;
        color: ${COLORS.TEXT.BLACK};
        font-family: inherit;
        font-size: 15px;
    }
`;

export default SearchPlaceInput;
