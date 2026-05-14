import { useCallback, useEffect, useRef, useState } from 'react';

import { css, keyframes } from '@emotion/react';
import { ChevronDown, ChevronLeft, ChevronUp, ImageOff } from 'lucide-react';
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
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
                <main css={imageListStyle}>
                    {images.map((image, index) => {
                        const prev = index > 0 ? images[index - 1] : null;
                        const next = index < images.length - 1 ? images[index + 1] : null;
                        return (
                            <div
                                key={image.mediaFileId}
                                ref={(el) => (imageRefs.current[index] = el)}
                                data-index={index}
                                css={photoSlotStyle}
                            >
                                {prev && (
                                    <button
                                        type='button'
                                        css={[peekStack, topPeek]}
                                        onClick={() => scrollToIndex(index - 1)}
                                        aria-label='이전 사진'
                                    >
                                        <img src={prev.mediaLink} alt='' css={peekThumb} />
                                        <ChevronDown size={12} strokeWidth={2.4} color='rgba(255,255,255,0.85)' />
                                    </button>
                                )}
                                <ImageItem image={image} onImageLoad={handleImageLoad} />
                                {next && (
                                    <button
                                        type='button'
                                        css={[peekStack, bottomPeek]}
                                        onClick={() => scrollToIndex(index + 1)}
                                        aria-label='다음 사진'
                                    >
                                        <ChevronUp size={12} strokeWidth={2.4} color='rgba(255,255,255,0.85)' />
                                        <img src={next.mediaLink} alt='' css={peekThumb} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </main>
            )}

            {images.length >= 5 && (
                <div css={progressColumn} aria-hidden>
                    {images.map((_, i) => (
                        <span key={i} css={progressDot(i === activeIdx)} />
                    ))}
                </div>
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

const imageListStyle = css`
    flex: 1;
    overflow-y: auto;
    scroll-snap-type: y mandatory;
    scroll-behavior: smooth;
    overscroll-behavior: contain;
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
        display: none;
    }
`;

const photoSlotStyle = css`
    position: relative;
    scroll-snap-align: center;
    scroll-snap-stop: always;
    min-height: calc(100dvh - 200px - 56px - 14px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 14px;
    box-sizing: border-box;
    background: #0a0a0a;
`;

const bobDown = keyframes`
    0%, 100% { transform: translate(-50%, 0); }
    50%      { transform: translate(-50%, 3px); }
`;

const bobUp = keyframes`
    0%, 100% { transform: translate(-50%, 0); }
    50%      { transform: translate(-50%, -3px); }
`;

const peekStack = css`
    position: absolute;
    left: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.42);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    cursor: pointer;
    z-index: 4;
    transform: translateX(-50%);
    transition: background 180ms ease;

    &:hover {
        background: rgba(0, 0, 0, 0.55);
    }
    &:active {
        background: rgba(0, 0, 0, 0.65);
    }
`;

const topPeek = css`
    top: 16px;
    animation: ${bobDown} 2.2s ease-in-out infinite;
`;

const bottomPeek = css`
    bottom: 16px;
    animation: ${bobUp} 2.2s ease-in-out infinite;
`;

const peekThumb = css`
    width: 28px;
    height: 28px;
    object-fit: cover;
    border-radius: 6px;
    display: block;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
`;

const progressColumn = css`
    position: fixed;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 20;
    pointer-events: none;
`;

const progressDot = (active: boolean) => css`
    width: ${active ? '3px' : '2px'};
    height: ${active ? '14px' : '4px'};
    border-radius: 2px;
    background: ${active ? '#0ea5e9' : 'rgba(255, 255, 255, 0.5)'};
    transition: width 220ms cubic-bezier(0.32, 0.72, 0, 1), height 220ms cubic-bezier(0.32, 0.72, 0, 1),
        background 200ms ease;
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
