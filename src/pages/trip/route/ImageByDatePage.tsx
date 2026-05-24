import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { css } from '@emotion/react';
import { ChevronLeft, ImageOff } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { useMediaByDate } from '@/domains/media/hooks/queries';
import { MediaFile } from '@/domains/media/types';
import DateSelector from '@/domains/trip/components/DateSelector';
import ImageItem from '@/domains/trip/components/ImageItem';
import { getNeighborhoodFromLocation } from '@/libs/utils/map';
import Spinner from '@/shared/components/common/Spinner';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import MultiMarkerMap from '@/shared/components/map/MultiMarkerMap';
import { GOOGLE_MAPS_MAP_ID } from '@/shared/constants/map';
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
    const carouselRef = useRef<HTMLDivElement | null>(null);
    const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const { isMapScriptLoaded, isMapScriptLoadError } = useMapScript();
    const { data: imagesResult } = useMediaByDate(tripKey || '', date || '');

    useEffect(() => {
        const ds: string[] = JSON.parse(sessionStorage.getItem('imageDates') || '[]');
        setDates(ds);
    }, []);

    // 날짜 전환 시 페인트 전에 캐러셀 스크롤·활성 인덱스를 동기 리셋
    useLayoutEffect(() => {
        setActiveIdx(0);
        if (carouselRef.current) {
            carouselRef.current.scrollLeft = 0;
        }
    }, [date]);

    useEffect(() => {
        if (imagesResult) {
            const imgs = imagesResult.success ? imagesResult.data : [];
            setImages(imgs);
            loadedImagesCount.current = 0;
            setActiveIdx(0);
            if (carouselRef.current) carouselRef.current.scrollLeft = 0;
            if (imgs.length === 0) setIsAllImageLoad(true);
        }
    }, [imagesResult]);

    // 가로 캐러셀 활성 인덱스 감지
    useEffect(() => {
        if (!images.length || !isAllImageLoad) return;
        if (!carouselRef.current) return;

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
            { root: carouselRef.current, threshold: 0.6 },
        );

        refs.forEach((ref) => observer.observe(ref));
        return () => observer.disconnect();
    }, [images, isAllImageLoad]);

    // 활성 thumb를 자동으로 중앙 정렬
    useEffect(() => {
        const el = thumbRefs.current[activeIdx];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, [activeIdx]);

    useEffect(() => {
        const img = images[activeIdx];
        if (!img || !isMapScriptLoaded) return;

        getNeighborhoodFromLocation({ latitude: img.latitude, longitude: img.longitude }).then(setActivePlace);

        const map = mapRef.current;
        if (!map) return;

        const newCenter = { lat: img.latitude, lng: img.longitude };
        const targetZoom = 17;

        if (GOOGLE_MAPS_MAP_ID) {
            (map as google.maps.Map).moveCamera({ center: newCenter, zoom: targetZoom });
        } else {
            map.panTo(newCenter);
            map.setZoom(targetZoom);
        }
    }, [activeIdx, images, isMapScriptLoaded]);

    const handleImageLoad = useCallback(() => {
        loadedImagesCount.current += 1;
        if (loadedImagesCount.current === images.length) setIsAllImageLoad(true);
    }, [images]);

    const scrollToIndex = useCallback((idx: number) => {
        const el = imageRefs.current[idx];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, []);

    if (isMapScriptLoadError) {
        showToast('지도를 불러오는데 실패했습니다, 다시 시도해주세요');
        navigate(ROUTES.PATH.TICKETS);
        return null;
    }

    const activeImage = images[activeIdx];

    return (
        <div css={container}>
            {!isAllImageLoad && <Indicator />}

            <button
                css={backButtonStyle}
                onClick={() => navigate(ROUTES.PATH.TRIP.ROOT(tripKey as string))}
                aria-label='뒤로 가기'
            >
                <ChevronLeft color='#fff' size={20} strokeWidth={2.4} />
            </button>

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

                {activeImage && activePlace && isAllImageLoad && (
                    <div css={infoCard} key={`${activeImage.mediaFileId}-${activeIdx}`}>
                        <div css={infoCardInner}>
                            <span css={infoCardDot} />
                            <span css={infoCardPlace}>{activePlace}</span>
                        </div>
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
                <>
                    {images.length > 1 && (
                        <div css={progressStrip} aria-hidden>
                            {images.map((_, i) => (
                                <span key={i} css={progressSegment(i, activeIdx)} />
                            ))}
                        </div>
                    )}

                    <main css={photoCarousel} ref={carouselRef}>
                        {images.map((image, index) => (
                            <div
                                key={image.mediaFileId}
                                ref={(el) => (imageRefs.current[index] = el)}
                                data-index={index}
                                css={photoSlotStyle}
                            >
                                <ImageItem image={image} onImageLoad={handleImageLoad} />
                            </div>
                        ))}
                    </main>

                    <div css={thumbStrip}>
                        {images.map((img, i) => (
                            <button
                                key={img.mediaFileId}
                                type='button'
                                ref={(el) => (thumbRefs.current[i] = el)}
                                css={thumbButton(i === activeIdx)}
                                onClick={() => scrollToIndex(i)}
                                aria-label={`사진 ${i + 1}`}
                            >
                                <img src={img.mediaLink} alt='' css={thumbImage} />
                            </button>
                        ))}
                    </div>
                </>
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
    overflow: hidden;
`;

const backButtonStyle = css`
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 30;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(10, 10, 12, 0.55);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.14);
    display: grid;
    place-items: center;
    cursor: pointer;
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.18) inset,
        0 10px 24px -12px rgba(0, 0, 0, 0.55);
    transition: transform 360ms cubic-bezier(0.32, 0.72, 0, 1), background 240ms ease;

    &:active {
        transform: scale(0.94);
        background: rgba(10, 10, 12, 0.7);
    }
`;

const mapWrap = css`
    position: relative;
    height: 200px;
    background: #f0eee7;
    overflow: hidden;
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
    left: 14px;
    bottom: 14px;
    padding: 3px;
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.45) 100%);
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.6) inset,
        0 14px 36px -16px rgba(15, 23, 42, 0.45),
        0 4px 12px -4px rgba(15, 23, 42, 0.18);
    backdrop-filter: blur(22px) saturate(180%);
    -webkit-backdrop-filter: blur(22px) saturate(180%);
    z-index: 10;
    max-width: 260px;
    animation: infoCardEnter 420ms cubic-bezier(0.32, 0.72, 0, 1) both;

    @keyframes infoCardEnter {
        from {
            opacity: 0;
            transform: translateY(6px) scale(0.96);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }
`;

const infoCardInner = css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px;
    border-radius: 15px;
    background: rgba(255, 255, 255, 0.78);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.5) inset;
`;

const infoCardDot = css`
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #0ea5e9;
    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.18);
    flex-shrink: 0;
`;

const infoCardPlace = css`
    font-size: 13px;
    font-weight: 700;
    color: #111;
    letter-spacing: -0.25px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
`;

const progressStrip = css`
    display: flex;
    gap: 4px;
    padding: 10px 14px 8px;
    background: #fff;
    flex-shrink: 0;
`;

const progressSegment = (idx: number, active: number) => css`
    flex: 1;
    height: 3px;
    border-radius: 2px;
    background: ${idx === active
        ? '#0ea5e9'
        : idx < active
        ? 'rgba(10, 10, 10, 0.42)'
        : 'rgba(10, 10, 10, 0.1)'};
    transition: background 240ms ease;
`;

const photoCarousel = css`
    flex: 1;
    min-height: 0;
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    overscroll-behavior: contain;
    background: #0a0a0a;
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
        display: none;
    }
`;

const photoSlotStyle = css`
    flex: 0 0 100%;
    width: 100%;
    height: 100%;
    scroll-snap-align: center;
    scroll-snap-stop: always;
    position: relative;
    background: #0a0a0a;
`;

const thumbStrip = css`
    display: flex;
    gap: 6px;
    padding: 10px 14px;
    background: #0a0a0a;
    overflow-x: auto;
    overscroll-behavior: contain;
    flex-shrink: 0;
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
        display: none;
    }
`;

const thumbButton = (isActive: boolean) => css`
    flex: 0 0 auto;
    width: 52px;
    height: 52px;
    border-radius: 8px;
    overflow: hidden;
    padding: 0;
    background: transparent;
    cursor: pointer;
    border: 2px solid ${isActive ? '#0ea5e9' : 'transparent'};
    opacity: ${isActive ? 1 : 0.55};
    transition: opacity 220ms ease, border 200ms ease, transform 200ms cubic-bezier(0.32, 0.72, 0, 1);

    &:active {
        transform: scale(0.94);
    }
`;

const thumbImage = css`
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
`;

const emptyImageList = css`
    flex: 1;
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
