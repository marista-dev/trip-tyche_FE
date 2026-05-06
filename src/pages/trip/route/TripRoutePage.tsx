import React, { useCallback, useEffect, useRef, useState } from 'react';

import { css } from '@emotion/react';
import { useNavigate, useParams } from 'react-router-dom';

import { MediaFile } from '@/domains/media/types';
import { removeDuplicateDates } from '@/domains/media/utils';
import MapControlButtons from '@/domains/route/components/MapControlButtons';
import PhotoCard from '@/domains/route/components/PhotoCard';
import Polyline from '@/domains/route/components/Polyline';
import { DURATION } from '@/domains/route/constants';
import { useRoute } from '@/domains/route/hooks/queries';
import { PinPoint } from '@/domains/route/types';
import { easeInOutCubic } from '@/domains/route/easing';
import { calculateDistance, getAnimationConfig, sortPinPointByDate } from '@/domains/route/utils';
import { addStartDateAndEndDateToImageDates } from '@/libs/utils/media';
import BackButton from '@/shared/components/common/Button/BackButton';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import CharacterMarker from '@/shared/components/map/CharacterMarker';
import ClusterMarker from '@/shared/components/map/ClusterMarker';
import Map from '@/shared/components/map/Map';
import Marker from '@/shared/components/map/Marker';
import { ZOOM_SCALE } from '@/shared/constants/map';
import { ROUTES } from '@/shared/constants/route';
import { COLORS } from '@/shared/constants/style';
import { MESSAGE } from '@/shared/constants/ui';
import { useMapControl } from '@/shared/hooks/useMapControl';
import { useToastStore } from '@/shared/stores/useToastStore';
import { Location } from '@/shared/types/map';

interface TripRouteInfo {
    title: string;
    startDate: string;
    endDate: string;
    imageDates: string[];
    tripImages: MediaFile[];
}

const ROUTE_PAGE_CONFIG = {
    PREFETCH_DELAY_MS: 1000,
    MEDIUM_DISTANCE_MIN_KM: 10,
    MEDIUM_DISTANCE_MAX_KM: 100,
    MEDIUM_DISTANCE_DELAY_MS: 1000,
    SHORT_DISTANCE_DELAY_MS: 50,
    PHOTO_CARD_HEIGHT_OFFSET: {
        CHARACTER_VIEW: 65,
        INDIVIDUAL_VIEW: 55,
    },
} as const;

const TripRoutePage = () => {
    const [tripRouteInfo, setTripRouteInfo] = useState<TripRouteInfo | null>(null);
    const [pinPoints, setPinPoints] = useState<PinPoint[]>([]);
    const [characterPosition, setCharacterPosition] = useState<Location | null>(null);

    const [currentPinPointIndex, setCurrentPinPointIndex] = useState(0);
    const [selectedIndividualMarker, setSelectedIndividualMarker] = useState<MediaFile | null>(null);

    const [isMapInteractive, setIsMapInteractive] = useState(true);
    const [isCharacterMoving, setIsCharacterMoving] = useState(false);
    const [isPlayingAnimation, setIsPlayingAnimation] = useState(false);

    const [currentTransportType, setCurrentTransportType] = useState('walking');
    const [showTravelMessage, setShowTravelMessage] = useState('');

    const { showToast } = useToastStore();
    const {
        mapRef,
        mapStatus,
        isMapScriptLoaded,
        isMapScriptLoadError,
        isMapRendered,
        handleMapRender,
        handleMapZoomChanged,
        updateMapCenter,
        updateMapZoom,
    } = useMapControl(ZOOM_SCALE.DEFAULT, characterPosition);

    const animationRef = useRef<number | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const autoPlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { tripKey } = useParams();
    const navigate = useNavigate();

    const { data: result, isLoading } = useRoute(tripKey!);

    const isLastPinPoint = currentPinPointIndex === pinPoints.length - 1;

    useEffect(() => {
        if (!isMapRendered) return;

        const prefetchImagePages = async () => {
            await new Promise((resolve) => setTimeout(resolve, ROUTE_PAGE_CONFIG.PREFETCH_DELAY_MS));
            Promise.allSettled([
                import('@/pages/trip/route/ImageByPinpointPage'),
                import('@/pages/trip/route/ImageByDatePage'),
            ]);
        };

        prefetchImagePages();
    }, [isMapRendered]);

    useEffect(() => {
        if (result) {
            if (!result.success) {
                showToast(result?.error || MESSAGE.ERROR.UNKNOWN);
                navigate(ROUTES.PATH.TICKETS);
                return;
            }

            const { tripTitle, startDate, endDate, pinPoints, mediaFiles: tripImages } = result.data;

            const validLocationPinPoints = sortPinPointByDate(pinPoints);
            const isValidTrip = tripTitle && startDate && endDate && tripImages.length !== 0;
            const imageDates = tripImages.map((image: MediaFile) => image.recordDate.split('T')[0]);

            if (validLocationPinPoints.length === 0) {
                showToast('여행 경로를 표시할 수 있는 사진이 없습니다');
                navigate(ROUTES.PATH.TICKETS);
                return;
            }

            if (!isValidTrip) {
                showToast('여행 정보가 올바르지 않아요. 정보를 다시 확인해주세요');
                navigate(ROUTES.PATH.TICKETS);
                return;
            }

            const initialPinPointPosition = {
                latitude: validLocationPinPoints[0].latitude,
                longitude: validLocationPinPoints[0].longitude,
            };

            setPinPoints(validLocationPinPoints);
            setCharacterPosition(initialPinPointPosition);
            setTripRouteInfo({
                title: tripTitle,
                startDate,
                endDate,
                imageDates: removeDuplicateDates(imageDates),
                tripImages,
            });
        }
    }, [result]);

    useEffect(() => {
        if (pinPoints.length > 0) {
            const recentPinPointId = sessionStorage.getItem('recentPinPointId');
            if (recentPinPointId) {
                const recentPinPointIndex = pinPoints.findIndex(
                    (pinPoint) => String(pinPoint.pinPointId) === recentPinPointId,
                );
                if (recentPinPointIndex !== -1) {
                    setCurrentPinPointIndex(recentPinPointIndex);
                    setCharacterPosition({
                        latitude: pinPoints[recentPinPointIndex].latitude,
                        longitude: pinPoints[recentPinPointIndex].longitude,
                    });
                }
            }
        }
    }, [pinPoints]);

    useEffect(() => {
        setIsPlayingAnimation(false);
        setIsCharacterMoving(false);

        return () => {
            if (autoPlayTimeoutRef.current) {
                clearTimeout(autoPlayTimeoutRef.current);
            }
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    const moveCharacter = useCallback(() => {
        if (isLastPinPoint) {
            setIsPlayingAnimation(false);
            setIsCharacterMoving(false);
            setIsMapInteractive(true);
            return;
        }

        const start = pinPoints[currentPinPointIndex];
        const end = pinPoints[currentPinPointIndex + 1];
        setIsCharacterMoving(true);
        setIsMapInteractive(false);
        const distance = calculateDistance(start.latitude, start.longitude, end.latitude, end.longitude);

        const settings = getAnimationConfig(distance);

        updateMapZoom(settings.zoomLevel);
        updateMapCenter(start);

        setCurrentTransportType(settings.transportType);
        setShowTravelMessage(
            distance >= 1 ? `${Math.round(distance).toLocaleString()}km 이동 중...` : '짧은 거리 이동 중...',
        );

        const animate = (time: number) => {
            if (!startTimeRef.current) {
                startTimeRef.current = time;
            }

            const rawProgress = Math.min((time - startTimeRef.current) / settings.duration, 1);
            const progress = easeInOutCubic(rawProgress);

            // 좌표 계산 - 직선 보간법 사용
            const newLat = start.latitude + (end.latitude - start.latitude) * progress;
            const newLng = start.longitude + (end.longitude - start.longitude) * progress;
            const newPosition = { latitude: newLat, longitude: newLng };

            setCharacterPosition(newPosition);

            if (rawProgress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                startTimeRef.current = null;
                setCurrentPinPointIndex((prev) => prev + 1);
                setIsCharacterMoving(false);
                setIsMapInteractive(true);
                setShowTravelMessage('');

                setCurrentTransportType('walking');
                updateMapZoom(ZOOM_SCALE.DEFAULT);

                autoPlayTimeoutRef.current = setTimeout(() => {
                    if (isPlayingAnimation) {
                        moveCharacter();
                    }
                }, DURATION.WAIT);
            }
        };

        const delay = distance > ROUTE_PAGE_CONFIG.MEDIUM_DISTANCE_MIN_KM && distance < ROUTE_PAGE_CONFIG.MEDIUM_DISTANCE_MAX_KM
            ? ROUTE_PAGE_CONFIG.MEDIUM_DISTANCE_DELAY_MS
            : ROUTE_PAGE_CONFIG.SHORT_DISTANCE_DELAY_MS;
        setTimeout(() => {
            setCharacterPosition(start);
            animationRef.current = requestAnimationFrame(animate);
        }, delay);
    }, [currentPinPointIndex, pinPoints, isPlayingAnimation, isLastPinPoint, updateMapCenter, updateMapZoom]);

    useEffect(() => {
        if (isPlayingAnimation && !isCharacterMoving) {
            autoPlayTimeoutRef.current = setTimeout(
                () => {
                    moveCharacter();
                },
                isLastPinPoint ? 0 : DURATION.WAIT,
            );
        }

        return () => {
            if (autoPlayTimeoutRef.current) {
                clearTimeout(autoPlayTimeoutRef.current);
            }
        };
    }, [isPlayingAnimation, isCharacterMoving, isLastPinPoint, moveCharacter]);

    const handleIndividualMarkerClick = (marker: MediaFile) => {
        if (mapRef.current) {
            updateMapCenter({ latitude: marker.latitude, longitude: marker.longitude });
        }
        setSelectedIndividualMarker(marker);
    };

    const showCharacterView = useCallback(() => {
        if (mapRef.current) {
            if (characterPosition) {
                updateMapCenter({ latitude: characterPosition.latitude, longitude: characterPosition.longitude });
            }
            updateMapZoom(ZOOM_SCALE.DEFAULT);
        }
    }, [mapRef, characterPosition, updateMapCenter, updateMapZoom]);

    const handleZoomChanged = () => {
        handleMapZoomChanged(() => {
            if (mapStatus.zoom < ZOOM_SCALE.INDIVIDUAL_IMAGE_MARKERS_VISIBLE) {
                setSelectedIndividualMarker(null);
            }
        });

        updateMapCenter({
            latitude: mapRef.current?.getCenter()?.lat() || 0,
            longitude: mapRef.current?.getCenter()?.lng() || 0,
        });
    };

    const handleMapClick = () => {
        setSelectedIndividualMarker(null);

        updateMapCenter({
            latitude: mapRef.current?.getCenter()?.lat() || 0,
            longitude: mapRef.current?.getCenter()?.lng() || 0,
        });
    };

    const togglePlayingAnimation = useCallback(() => {
        if (isLastPinPoint) {
            const initialPinPointPosition = { latitude: pinPoints[0].latitude, longitude: pinPoints[0].longitude };
            updateMapCenter({
                latitude: initialPinPointPosition.latitude,
                longitude: initialPinPointPosition.longitude,
            });
            setCurrentPinPointIndex(0);
            setCharacterPosition(initialPinPointPosition);
            setIsCharacterMoving(false);
        } else {
            setIsPlayingAnimation(!isPlayingAnimation);
            if (!isPlayingAnimation) {
                if (autoPlayTimeoutRef.current) {
                    clearTimeout(autoPlayTimeoutRef.current);
                }
                moveCharacter();
            }
        }
    }, [pinPoints, isPlayingAnimation, isLastPinPoint, moveCharacter, updateMapCenter]);

    const navigateImagesByDatePage = useCallback(() => {
        const { startDate, endDate, imageDates: dates } = tripRouteInfo || {};
        const imageDates = addStartDateAndEndDateToImageDates(startDate || '', endDate || '', dates || []);
        const recentPinPointId = String(pinPoints[currentPinPointIndex].pinPointId);

        sessionStorage.setItem('recentPinPointId', recentPinPointId);
        sessionStorage.setItem('imageDates', JSON.stringify(imageDates));

        navigate(`${ROUTES.PATH.TRIP.IMAGE.BY_DATE(String(tripKey), imageDates[0])}`);
    }, [tripKey, tripRouteInfo, pinPoints, currentPinPointIndex, navigate]);

    const handlePinPointMarkClick = (position: PinPoint, index: number) => {
        setCharacterPosition(position);
        setCurrentPinPointIndex(index);
        setIsCharacterMoving(false);
        setIsPlayingAnimation(false);

        // TODO: 깜빡거림 현상 분석 (없으면 깜빡)
        updateMapCenter({
            latitude: mapRef.current?.getCenter()?.lat() || 0,
            longitude: mapRef.current?.getCenter()?.lng() || 0,
        });
    };

    const renderMarkers = () => {
        if (isCharacterVisible) {
            return (
                <>
                    {/* TODO: 컴포넌트 분리 및 useCallback, useMemo 사용 */}
                    {pinPoints.map((point, index) => {
                        return (
                            <React.Fragment key={point.pinPointId}>
                                <Marker
                                    mapRef={mapRef}
                                    position={{ latitude: point.latitude, longitude: point.longitude }}
                                    isMapRendered={isMapRendered}
                                    isVisible={!isPinPointOnCharacter(point)}
                                    onClick={() =>
                                        isCharacterMoving ? undefined : handlePinPointMarkClick(point, index)
                                    }
                                />
                                <PhotoCard
                                    position={{
                                        latitude: characterPosition?.latitude || 0,
                                        longitude: characterPosition?.longitude || 0,
                                    }}
                                    image={point.mediaLink}
                                    heightOffset={ROUTE_PAGE_CONFIG.PHOTO_CARD_HEIGHT_OFFSET.CHARACTER_VIEW}
                                    isVisible={isPhotoCardVisible(index)}
                                    onClick={() =>
                                        navigate(`${ROUTES.PATH.TRIP.IMAGE.BY_PINPOINT(tripKey!, point.pinPointId)}`)
                                    }
                                />
                            </React.Fragment>
                        );
                    })}
                    {characterPosition && (
                        <CharacterMarker
                            position={{
                                latitude: characterPosition?.latitude,
                                longitude: characterPosition?.longitude,
                            }}
                            transportType={currentTransportType}
                            isMapRendered={isMapRendered}
                        />
                    )}
                    {showTravelMessage && <div css={travelMessageStyle}>{showTravelMessage}</div>}
                </>
            );
        } else if (isIndividualImageMarkersVisible) {
            return (
                <>
                    {/* TODO: 컴포넌트 분리 및 useCallback, useMemo 사용 */}
                    {tripRouteInfo?.tripImages.map((image) => {
                        return (
                            <Marker
                                mapRef={mapRef}
                                key={image.mediaFileId}
                                isClick={!!(image.mediaFileId === selectedIndividualMarker?.mediaFileId)}
                                position={{ latitude: image.latitude, longitude: image.longitude }}
                                isMapRendered={isMapRendered}
                                isIndividualImageMarker
                                onClick={() => handleIndividualMarkerClick(image)}
                            />
                        );
                    })}
                    {selectedIndividualMarker && (
                        <PhotoCard
                            position={selectedIndividualMarker}
                            image={selectedIndividualMarker.mediaLink}
                            heightOffset={ROUTE_PAGE_CONFIG.PHOTO_CARD_HEIGHT_OFFSET.INDIVIDUAL_VIEW}
                            isVisible={!!selectedIndividualMarker}
                        />
                    )}
                </>
            );
        } else {
            return <ClusterMarker mapRef={mapRef} images={tripRouteInfo?.tripImages || []} />;
        }
    };

    if (!isMapScriptLoaded || isLoading || !mapStatus.center) {
        return <Indicator />;
    }

    if (isMapScriptLoadError) {
        showToast('지도를 불러오는데 실패했습니다');
        navigate(ROUTES.PATH.TICKETS);
        return;
    }

    const isPinPointOnCharacter = (pinPoint: PinPoint) =>
        characterPosition?.latitude === pinPoint.latitude && characterPosition?.longitude === pinPoint.longitude;
    const isCharacterVisible = isCharacterMoving || mapStatus.zoom === ZOOM_SCALE.DEFAULT;
    const isIndividualImageMarkersVisible = mapStatus.zoom >= ZOOM_SCALE.INDIVIDUAL_IMAGE_MARKERS_VISIBLE;
    const isPhotoCardVisible = (photoCardIndex: number) =>
        !!(photoCardIndex === currentPinPointIndex && !isCharacterMoving);
    // TODO: 깜빡거림 현상 분석
    // const mapCenter = isCharacterVisible
    //     ? { latitude: characterPosition?.latitude || 0, longitude: characterPosition?.longitude || 0 }
    //     : mapStatus.center;

    return (
        <div css={container}>
            <BackButton onClick={() => navigate(`${ROUTES.PATH.TICKETS}`)} />

            <Map
                zoom={mapStatus.zoom}
                // center={mapCenter} // TODO: 깜빡거림 현상 분석
                center={mapStatus.center}
                isInteractive={isMapInteractive}
                onLoad={handleMapRender}
                onZoomChanged={handleZoomChanged}
                onClick={handleMapClick}
            >
                <>
                    <Polyline pinPoints={pinPoints} isCharacterVisible={isCharacterVisible} />
                    {renderMarkers()}
                    <MapControlButtons
                        isVisible={!isCharacterMoving}
                        isCharacterView={isCharacterVisible}
                        isLastPinPoint={isLastPinPoint}
                        isCharacterPlaying={isPlayingAnimation}
                        handler={{
                            handleDateViewClick: navigateImagesByDatePage,
                            handleCharacterViewClick: showCharacterView,
                            handleCharacterPlayToggle: togglePlayingAnimation,
                        }}
                    />
                </>
            </Map>
        </div>
    );
};

const container = css`
    height: 100dvh;
    display: flex;
    flex-direction: column;
    position: relative;
`;

const travelMessageStyle = css`
    position: absolute;
    top: 70px;
    left: 50%;
    transform: translateX(-50%);
    background-color: ${COLORS.BACKGROUND.OVERLAY};
    color: ${COLORS.BACKGROUND.WHITE};
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 14px;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
`;

export default TripRoutePage;
