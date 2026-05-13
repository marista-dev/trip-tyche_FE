import { useCallback, useEffect, useMemo, useState } from 'react';

import { css } from '@emotion/react';
import { useNavigate, useParams } from 'react-router-dom';

import CinematicDroneMap from '@/domains/route/components/CinematicDroneMap';
import MapControlButtons from '@/domains/route/components/MapControlButtons';
import { useRoute } from '@/domains/route/hooks/queries';
import { PinPoint } from '@/domains/route/types';
import { sortPinPointByDate } from '@/domains/route/utils';
import { addStartDateAndEndDateToImageDates } from '@/libs/utils/media';
import { removeDuplicateDates } from '@/domains/media/utils';
import BackButton from '@/shared/components/common/Button/BackButton';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import Map from '@/shared/components/map/Map';
import { DEFAULT_CENTER, ZOOM_SCALE } from '@/shared/constants/map';
import { ROUTES } from '@/shared/constants/route';
import { MESSAGE } from '@/shared/constants/ui';
import { useMapControl } from '@/shared/hooks/useMapControl';
import { useToastStore } from '@/shared/stores/useToastStore';

const RESUME_KEY = 'cinematicResumeIdx';

const TripRoutePage = () => {
    const { tripKey } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToastStore();
    const { data: result, isLoading } = useRoute(tripKey!);

    // 초기 center를 첫 PinPoint로 고정 — 매 렌더마다 동일 reference 유지
    const initialCenter = useMemo(() => {
        if (result?.success && result.data.pinPoints.length > 0) {
            const first = result.data.pinPoints[0];
            return { latitude: first.latitude, longitude: first.longitude };
        }
        return { latitude: DEFAULT_CENTER.latitude, longitude: DEFAULT_CENTER.longitude };
    }, [result]);
    const {
        mapStatus,
        isMapScriptLoaded,
        isMapScriptLoadError,
        handleMapRender,
    } = useMapControl(ZOOM_SCALE.DEFAULT, initialCenter);

    const [pinPoints, setPinPoints] = useState<PinPoint[]>([]);
    const [tripStartDate, setTripStartDate] = useState('');
    const [tripEndDate, setTripEndDate] = useState('');
    const [imageDates, setImageDates] = useState<string[]>([]);
    const [isComplete, setIsComplete] = useState(false);
    const [tourKey, setTourKey] = useState(0);
    const [initialResumeIdx] = useState(() => {
        const stored = sessionStorage.getItem(RESUME_KEY);
        return stored ? parseInt(stored, 10) || 0 : 0;
    });
    const [progressIdx, setProgressIdx] = useState(initialResumeIdx);
    const [isDwelling, setIsDwelling] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (result?.success) {
            const { startDate, endDate, pinPoints, mediaFiles } = result.data;
            const valid = sortPinPointByDate(pinPoints);
            if (valid.length === 0) {
                showToast('여행 경로를 표시할 수 있는 사진이 없습니다');
                navigate(ROUTES.PATH.TICKETS);
                return;
            }
            setPinPoints(valid);
            setTripStartDate(startDate);
            setTripEndDate(endDate);
            setImageDates(removeDuplicateDates(mediaFiles.map((m) => m.recordDate.split('T')[0])));
        } else if (result && !result.success) {
            showToast(result?.error || MESSAGE.ERROR.UNKNOWN);
            navigate(ROUTES.PATH.TICKETS);
        }
    }, [result, navigate, showToast]);

    const handlePhotoMarkerClick = useCallback((idx: number) => {
        const pinPoint = pinPoints[idx];
        if (!pinPoint) return;
        sessionStorage.setItem(RESUME_KEY, String(idx));
        navigate(ROUTES.PATH.TRIP.IMAGE.BY_PINPOINT(tripKey!, pinPoint.pinPointId));
    }, [pinPoints, navigate, tripKey]);

    const handleFlightStart = useCallback((targetIdx: number) => {
        setProgressIdx(targetIdx);
    }, []);

    const handleDwellStart = useCallback((idx: number) => {
        setProgressIdx(idx);
        setIsDwelling(true);
    }, []);

    const handleDwellEnd = useCallback(() => {
        setIsDwelling(false);
        setIsPaused(false);
    }, []);

    const handlePauseToggle = useCallback(() => {
        setIsPaused((p) => !p);
    }, []);

    const handleExitToTickets = useCallback(() => {
        sessionStorage.removeItem(RESUME_KEY);
        navigate(ROUTES.PATH.TICKETS);
    }, [navigate]);

    const handleVectorUnavailable = useCallback(() => {
        showToast('3D 드론 뷰를 사용할 수 없는 환경입니다. Map ID 설정을 확인해주세요.');
        navigate(ROUTES.PATH.TICKETS);
    }, [navigate, showToast]);

    const handleComplete = useCallback(() => {
        setIsComplete(true);
        sessionStorage.removeItem(RESUME_KEY);
    }, []);

    const handleRestart = useCallback(() => {
        sessionStorage.removeItem(RESUME_KEY);
        setProgressIdx(0);
        setIsComplete(false);
        setIsDwelling(false);
        setIsPaused(false);
        setTourKey((k) => k + 1);
    }, []);

    const handleDateViewClick = useCallback(() => {
        const dates = addStartDateAndEndDateToImageDates(tripStartDate, tripEndDate, imageDates);
        sessionStorage.setItem('imageDates', JSON.stringify(dates));
        if (dates.length > 0) {
            navigate(ROUTES.PATH.TRIP.IMAGE.BY_DATE(tripKey!, dates[0]));
        }
    }, [tripStartDate, tripEndDate, imageDates, navigate, tripKey]);

    if (!isMapScriptLoaded || isLoading || pinPoints.length === 0 || !mapStatus.center) {
        return <Indicator />;
    }

    if (isMapScriptLoadError) {
        showToast('지도를 불러올 수 없습니다');
        return null;
    }

    const startFromIdx = tourKey === 0 ? initialResumeIdx : 0;
    const currentPinPointDate = pinPoints[progressIdx]?.recordDate;

    return (
        <div css={container}>
            <BackButton onClick={handleExitToTickets} />

            <Map
                zoom={mapStatus.zoom}
                center={mapStatus.center}
                isInteractive={false}
                onLoad={handleMapRender}
            >
                <CinematicDroneMap
                    key={tourKey}
                    pinPoints={pinPoints}
                    startFromIdx={startFromIdx}
                    isPaused={isPaused}
                    onFlightStart={handleFlightStart}
                    onDwellStart={handleDwellStart}
                    onDwellEnd={handleDwellEnd}
                    onPhotoMarkerClick={handlePhotoMarkerClick}
                    onComplete={handleComplete}
                    onVectorUnavailable={handleVectorUnavailable}
                />
            </Map>

            <MapControlButtons
                isVisible={isDwelling || isComplete}
                isComplete={isComplete}
                isPaused={isPaused}
                currentPinPointIndex={progressIdx}
                totalPinPoints={pinPoints.length}
                currentDate={currentPinPointDate}
                handler={{
                    handleDateViewClick,
                    handleRestart,
                    handlePauseToggle,
                }}
            />
        </div>
    );
};

const container = css`
    position: relative;
    width: 100%;
    height: 100dvh;
    background: #000;
    overflow: hidden;
`;

export default TripRoutePage;
