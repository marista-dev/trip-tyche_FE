import { useEffect, useState, useRef, useCallback } from 'react';

import { css } from '@emotion/react';
import { ImageOff } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { useMediaByDate } from '@/domains/media/hooks/queries';
import { MediaFile } from '@/domains/media/types';
import DateSelector from '@/domains/trip/components/DateSelector';
import ImageItem from '@/domains/trip/components/ImageItem';
import { getNeighborhoodFromLocation } from '@/libs/utils/map';
import BackButton from '@/shared/components/common/Button/BackButton';
import Spinner from '@/shared/components/common/Spinner';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import MultiMarkerMap from '@/shared/components/map/MultiMarkerMap';
import { GOOGLE_MAPS_MAP_ID, ZOOM_SCALE } from '@/shared/constants/map';
import { ROUTES } from '@/shared/constants/route';
import { COLORS } from '@/shared/constants/style';
import { useMapScript } from '@/shared/hooks/useMapScript';
import { useToastStore } from '@/shared/stores/useToastStore';
import { MapType } from '@/shared/types/map';

const ImageByDatePage = () => {
    const [images, setImages] = useState<MediaFile[]>([]);
    const [dates, setDates] = useState<string[]>([]);
    const [activeIdx, setActiveIdx] = useState(0);
    const [activePlace, setActivePlace] = useState('');
    const [isAllImageLoad, setIsAllImageLoad] = useState(false);

    const showToast = useToastStore((state) => state.showToast);

    const { tripKey, date } = useParams();
    const navigate = useNavigate();

    const mapRef = useRef<MapType | null>(null);
    const loadedImagesCount = useRef<number>(0);
    const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

    const { isMapScriptLoaded, isMapScriptLoadError } = useMapScript();
    const { data: imagesResult } = useMediaByDate(tripKey || '', date || '');

    useEffect(() => {
        const ds: string[] = JSON.parse(sessionStorage.getItem('imageDates') || '[]');
        setDates(ds);
    }, []);

    useEffect(() => {
        if (imagesResult) {
            const imgs = imagesResult.success ? imagesResult.data : [];
            setImages(imgs);
            loadedImagesCount.current = 0;
            setActiveIdx(0);
            if (imgs.length === 0) setIsAllImageLoad(true);
        }
    }, [imagesResult]);

    // 스크롤 기반 활성 이미지 감지
    useEffect(() => {
        if (!images.length || !isAllImageLoad) return;

        const refs = imageRefs.current.filter(Boolean) as HTMLDivElement[];
        if (!refs.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const mostVisible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
                if (mostVisible) {
                    const idx = Number((mostVisible.target as HTMLElement).dataset.index);
                    setActiveIdx(idx);
                }
            },
            { threshold: 0.6 },
        );

        refs.forEach((ref) => observer.observe(ref));
        return () => observer.disconnect();
    }, [images, isAllImageLoad]);

    // activeIdx 변경 시 지도 애니메이션 + 역지오코딩
    useEffect(() => {
        const img = images[activeIdx];
        if (!img || !isMapScriptLoaded) return;

        // 역지오코딩 (0.5km 정밀도)
        getNeighborhoodFromLocation({ latitude: img.latitude, longitude: img.longitude }).then(setActivePlace);

        // 지도 애니메이션: 줌아웃 → 팬 → 줌인
        const map = mapRef.current;
        if (!map) return;

        const newCenter = { lat: img.latitude, lng: img.longitude };
        const currentZoom = map.getZoom() ?? ZOOM_SCALE.DEFAULT;
        const outZoom = Math.max(currentZoom - 3, 8);

        if (GOOGLE_MAPS_MAP_ID) {
            // Vector map: moveCamera로 부드럽게
            (map as google.maps.Map).moveCamera({ center: newCenter, zoom: outZoom });
            const timer = setTimeout(() => {
                (map as google.maps.Map).moveCamera({ zoom: ZOOM_SCALE.DEFAULT });
            }, 350);
            return () => clearTimeout(timer);
        } else {
            // Raster map: setZoom + panTo
            map.setZoom(outZoom);
            const timer = setTimeout(() => {
                map.panTo(newCenter);
                map.setZoom(ZOOM_SCALE.DEFAULT);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [activeIdx, images, isMapScriptLoaded]);

    const handleImageLoad = useCallback(() => {
        loadedImagesCount.current += 1;
        if (loadedImagesCount.current === images.length) setIsAllImageLoad(true);
    }, [images]);

    if (isMapScriptLoadError) {
        showToast('지도를 불러오는데 실패했습니다, 다시 시도해주세요');
        navigate(ROUTES.PATH.TICKETS);
        return null;
    }

    const activeImage = images[activeIdx];
    const activeTime = activeImage?.recordDate?.split('T')[1]?.slice(0, 5) ?? '';

    return (
        <div css={container}>
            {!isAllImageLoad && <Indicator />}

            <BackButton onClick={() => navigate(ROUTES.PATH.TRIP.ROOT(tripKey as string))} />

            {/* 스티키 지도 */}
            <div css={mapWrap}>
                {isMapScriptLoaded && isAllImageLoad ? (
                    <MultiMarkerMap
                        positions={images.map((img) => ({
                            latitude: img.latitude,
                            longitude: img.longitude,
                        }))}
                        activeIndex={activeIdx}
                        mapRef={mapRef}
                    />
                ) : (
                    <div css={mapLoader}>
                        <Spinner />
                    </div>
                )}

                {/* 정보 카드 */}
                {activeImage && isAllImageLoad && (
                    <div css={infoCard}>
                        <div css={infoTime}>{activeTime}</div>
                        {activePlace && <div css={infoPlace}>{activePlace}</div>}
                    </div>
                )}
            </div>

            <DateSelector selectedDate={date!} dates={dates} />

            {images.length === 0 ? (
                <div css={emptyImageList}>
                    <div css={emptyIcon}>
                        <ImageOff color='white' />
                    </div>
                    <h3 css={emptyImageListHeading}>등록된 사진이 없어요</h3>
                    <p css={emptyImageListDescription}>{`티켓 속 사진 관리에서\n새로운 사진을 등록해주세요`}</p>
                </div>
            ) : (
                <main css={imageListStyle}>
                    {images.map((image, index) => (
                        <div
                            key={image.mediaFileId}
                            ref={(el) => (imageRefs.current[index] = el)}
                            data-index={index}
                        >
                            <ImageItem
                                image={image}
                                isActive={index === activeIdx}
                                onImageLoad={handleImageLoad}
                            />
                        </div>
                    ))}
                </main>
            )}
        </div>
    );
};

const container = css`
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: #fafafa;
    position: relative;
    user-select: none;
`;

const mapWrap = css`
    position: relative;
    height: 200px;
    flex-shrink: 0;
`;

const mapLoader = css`
    height: 200px;
    display: flex;
    justify-content: center;
    align-items: center;
`;

const infoCard = css`
    position: absolute;
    left: 12px;
    bottom: 12px;
    background: #fff;
    border-radius: 12px;
    padding: 8px 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    max-width: 220px;
    z-index: 10;
`;

const infoTime = css`
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #888;
`;

const infoPlace = css`
    font-size: 13px;
    font-weight: 700;
    color: #111;
    letter-spacing: -0.2px;
    margin-top: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const imageListStyle = css`
    flex: 1;
    overflow-y: auto;
    padding: 12px 12px 32px;
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const emptyImageList = css`
    height: 60%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
`;

const emptyImageListHeading = css`
    margin-top: 18px;
    color: #303038;
    font-size: 18px;
    font-weight: bold;
`;

const emptyImageListDescription = css`
    margin-top: 8px;
    color: #767678;
    font-size: 15px;
    line-height: 21px;
    text-align: center;
    white-space: pre-line;
`;

const emptyIcon = css`
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: ${COLORS.TEXT.DESCRIPTION_LIGHT};
`;

export default ImageByDatePage;
