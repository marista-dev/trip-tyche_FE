import { useEffect, useState } from 'react';

import { css } from '@emotion/react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { useMetadataUpdate } from '@/domains/media/hooks/mutations';
import { useEstimateStore } from '@/domains/media/stores/useEstimateStore';
import { MediaFile } from '@/domains/media/types';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import SearchPlaceInput from '@/shared/components/map/SearchPlaceInput';
import SingleMarkerMap from '@/shared/components/map/SingleMarkerMap';
import { DEFAULT_CENTER, ZOOM_SCALE } from '@/shared/constants/map';
import { ROUTES } from '@/shared/constants/route';
import { useMapControl } from '@/shared/hooks/useMapControl';
import { useToastStore } from '@/shared/stores/useToastStore';
import { Location, MapMouseEvent } from '@/shared/types/map';

// 위치 없는 사진들에 한 번에 위치를 지정하는 풀스크린 지도 페이지.
// 두 가지 진입 경로 지원:
//  1) NoLocationResolvePage → store에 mode='map-pick'으로 targets 채운 뒤 이 route로 이동 (다수 사진)
//  2) TimeBasedEstimatePage → navigate state로 단일 target 전달 (store 안 건드림 → 돌아갔을 때
//     time estimate 컨텍스트 보존). useLocation().state.singleTarget으로 인식
const MapPickPage = () => {
    const { tripKey = '' } = useParams<{ tripKey: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToastStore();
    const { mode, tripKey: storeTripKey, targets: storeTargets, clear } = useEstimateStore();

    // navigate state로 들어왔으면 그 사진 1장만 처리 (store 우회). store 진입이면 storeTargets 사용.
    const navState = location.state as { singleTarget?: MediaFile } | null;
    const singleTarget = navState?.singleTarget;
    const usingNavState = !!singleTarget;
    const targets: MediaFile[] = usingNavState ? [singleTarget] : storeTargets;

    const { mapRef, isMapScriptLoaded, updateMapCenter } = useMapControl(ZOOM_SCALE.DEFAULT, DEFAULT_CENTER);
    const { mutate: updateMutate, isPending: isApplying } = useMetadataUpdate();

    const [picked, setPicked] = useState<Location | null>(null);

    // store 비어 있거나 모드 안 맞으면 폴백. navState로 들어온 경우는 가드 건너뜀.
    useEffect(() => {
        if (usingNavState) return;
        if (storeTargets.length === 0 || mode !== 'map-pick' || storeTripKey !== tripKey) {
            showToast('처리할 사진을 다시 선택해주세요');
            navigate(ROUTES.PATH.TRIP.EDIT.NO_LOCATION(tripKey), { replace: true });
        }
    }, [usingNavState, mode, storeTripKey, tripKey, storeTargets.length, navigate, showToast]);

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
                        // navState 진입(sub-flow)이면 store를 건드리지 않음 — 호출자(TimeBased 등)의
                        // estimate 컨텍스트를 그대로 유지해야 돌아갔을 때 redirect 가드에 안 걸림.
                        if (!usingNavState) clear();
                        navigate(-1);
                    } else {
                        showToast(result.error);
                    }
                },
            },
        );
    };

    return (
        <div css={pageStyle}>
            {!isMapScriptLoaded && <Indicator />}
            {isApplying && <Indicator text='적용 중...' />}

            <SearchPlaceInput
                isMapScriptLoaded={isMapScriptLoaded}
                isBackButtonDisable={isApplying}
                onLocationChange={handlePlaceSelect}
                onBack={() => navigate(-1)}
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

const pageStyle = css`
    position: fixed;
    inset: 0;
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
    pointer-events: none;
    & > button {
        pointer-events: auto;
    }
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

export default MapPickPage;
