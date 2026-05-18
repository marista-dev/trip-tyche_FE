import { useState } from 'react';

import { css } from '@emotion/react';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { useMetadataUpdate } from '@/domains/media/hooks/mutations';
import { MediaFile } from '@/domains/media/types';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import SearchPlaceInput from '@/shared/components/map/SearchPlaceInput';
import SingleMarkerMap from '@/shared/components/map/SingleMarkerMap';
import { DEFAULT_CENTER, ZOOM_SCALE } from '@/shared/constants/map';
import { useMapControl } from '@/shared/hooks/useMapControl';
import { useToastStore } from '@/shared/stores/useToastStore';
import { Location, MapMouseEvent } from '@/shared/types/map';

interface InlineMapPickPageProps {
    tripKey: string;
    targets: MediaFile[];
    onClose: () => void;
    onApplied: () => void;
}

const InlineMapPickPage = ({ tripKey, targets, onClose, onApplied }: InlineMapPickPageProps) => {
    const { showToast } = useToastStore();
    const { mapRef, isMapScriptLoaded, updateMapCenter } = useMapControl(ZOOM_SCALE.DEFAULT, DEFAULT_CENTER);
    const { mutate: updateMutate, isPending: isApplying } = useMetadataUpdate();

    const [picked, setPicked] = useState<Location | null>(null);

    const handlePlaceSelect = (latitude: number, longitude: number) => {
        const loc = { latitude, longitude };
        setPicked(loc);
        updateMapCenter(loc);
    };

    const handleMapClick = (event: MapMouseEvent | undefined) => {
        if (event?.latLng) {
            setPicked({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
        }
    };

    const handleApply = () => {
        if (!picked) return;
        const updated = targets.map((t) => ({ ...t, latitude: picked.latitude, longitude: picked.longitude }));
        updateMutate(
            { tripKey, images: updated },
            {
                onSuccess: (result) => {
                    if (result.success) {
                        showToast(`${updated.length}장에 위치가 적용되었어요`);
                        onApplied();
                    } else {
                        showToast(result.error);
                    }
                },
            },
        );
    };

    return (
        <div css={overlayStyle}>
            {!isMapScriptLoaded && <Indicator />}
            {isApplying && <Indicator text='적용 중...' />}

            <SearchPlaceInput
                isMapScriptLoaded={isMapScriptLoaded}
                isBackButtonDisable={isApplying}
                onLocationChange={handlePlaceSelect}
                onBack={onClose}
            />

            <SingleMarkerMap mapRef={mapRef} position={picked} onMapClick={handleMapClick} mapHeight='100dvh' />

            <div css={ctaBarStyle}>
                <button
                    type='button'
                    css={ctaButtonStyle(!!picked && !isApplying)}
                    disabled={!picked || isApplying}
                    onClick={handleApply}
                >
                    {isApplying ? '적용 중...' : `${targets.length}장에 위치 등록`}
                </button>
            </div>
        </div>
    );
};

const overlayStyle = css`
    position: fixed;
    inset: 0;
    z-index: 995;
    background: ${MANAGE_TOKENS.bg};
    font-family: ${MANAGE_TOKENS.font};
`;

const ctaBarStyle = css`
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 12px 16px 24px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.98) 30%);
    z-index: 999;
`;

const ctaButtonStyle = (active: boolean) => css`
    width: 100%;
    padding: 14px 0;
    border: none;
    border-radius: 14px;
    background: ${active ? MANAGE_TOKENS.accent : 'rgba(0,0,0,0.15)'};
    color: #fff;
    font-family: inherit;
    font-size: 15px;
    font-weight: 700;
    cursor: ${active ? 'pointer' : 'not-allowed'};
    box-shadow: ${active ? '0 8px 22px rgba(0,113,227,0.3)' : 'none'};
    -webkit-tap-highlight-color: transparent;
    &:active {
        opacity: ${active ? 0.9 : 1};
    }
`;

export default InlineMapPickPage;
