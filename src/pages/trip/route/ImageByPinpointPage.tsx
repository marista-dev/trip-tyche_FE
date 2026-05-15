import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { css } from '@emotion/react';
import { ImageOff, Info, MapPin, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { useMediaByPinPoint } from '@/domains/media/hooks/queries';
import { useAutoAdvance } from '@/domains/media/hooks/useAutoAdvance';
import { useGestureRouter } from '@/domains/media/hooks/useGestureRouter';
import { getPreciseLocationFromCoordinate } from '@/libs/utils/map';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import { ROUTES } from '@/shared/constants/route';
import { useMapScript } from '@/shared/hooks/useMapScript';

const PER_PHOTO_MS = 5000;
const ZOOM_OUT = 1;
const ZOOM_IN = 2.2;
const ZOOM_MAX = 4;
const ZOOM_SNAP_THRESHOLD = 1.15;
const SWIPE_TOLERANCE_PX = 10;
const SWIPE_RESUME_DELAY_MS = 320;
const HINT_AUTO_FADE_MS = 4500;
const HINT_UNMOUNT_DELAY_MS = 400;
const ACCENT = '#ffffff';
const LETTERBOX_BG = '#0a0a0a';

const ImageByPinpointPage = () => {
    const { tripKey, pinPointId } = useParams();
    const navigate = useNavigate();

    const { data: result, isLoading } = useMediaByPinPoint(tripKey!, pinPointId!);
    const { isMapScriptLoaded } = useMapScript();

    const images = useMemo(() => (result?.success ? result.data : []), [result]);
    const count = images.length;

    const advance = useAutoAdvance(count, PER_PHOTO_MS);
    const { goTo: advanceGoTo } = advance;
    const [zoom, setZoom] = useState<number>(ZOOM_OUT);
    const [isPinching, setIsPinching] = useState<boolean>(false);
    const [placeName, setPlaceName] = useState<string>('');
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    const carouselRef = useRef<HTMLDivElement | null>(null);
    const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
    const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const swipedRef = useRef<boolean>(false);
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
    const wasPlayingBeforeSwipeRef = useRef<boolean>(false);
    const wasPlayingBeforeZoomRef = useRef<boolean>(false);
    const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
    const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);
    const panStartRef = useRef<{ px: number; py: number; panX: number; panY: number } | null>(null);

    const [hintMounted, setHintMounted] = useState<boolean>(false);
    const [hintVisible, setHintVisible] = useState<boolean>(false);

    const activeImage = images[advance.index];

    useEffect(() => {
        if (!images.length || !isMapScriptLoaded) return;
        const first = images[0];
        getPreciseLocationFromCoordinate({ latitude: first.latitude, longitude: first.longitude })
            .then(setPlaceName)
            .catch(() => setPlaceName(''));
    }, [images, isMapScriptLoaded]);

    useEffect(() => {
        if (count === 0 || !carouselRef.current) return;
        const root = carouselRef.current;
        const refs = imageRefs.current.filter(Boolean) as HTMLDivElement[];
        if (!refs.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const mostVisible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
                if (!mostVisible) return;
                const idx = Number((mostVisible.target as HTMLElement).dataset.index);
                advanceGoTo(idx);
            },
            { root, threshold: 0.6 },
        );

        refs.forEach((ref) => observer.observe(ref));
        return () => observer.disconnect();
    }, [count, advanceGoTo]);

    useEffect(() => {
        if (swipedRef.current) return;
        const el = imageRefs.current[advance.index];
        if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, [advance.index]);

    useEffect(() => {
        const el = thumbRefs.current[advance.index];
        if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, [advance.index]);

    useEffect(() => {
        setZoom(ZOOM_OUT);
        setPan({ x: 0, y: 0 });
    }, [advance.index]);

    useEffect(() => {
        if (zoom <= ZOOM_OUT) setPan({ x: 0, y: 0 });
    }, [zoom]);

    useEffect(() => {
        if (!hintMounted) return;
        const fadeId = window.setTimeout(() => setHintVisible(false), HINT_AUTO_FADE_MS);
        return () => clearTimeout(fadeId);
    }, [hintMounted]);

    useEffect(() => {
        if (hintVisible || !hintMounted) return;
        const unmountId = window.setTimeout(() => setHintMounted(false), HINT_UNMOUNT_DELAY_MS);
        return () => clearTimeout(unmountId);
    }, [hintVisible, hintMounted]);

    const dismissHint = useCallback(() => {
        setHintVisible(false);
    }, []);

    const showHint = useCallback(() => {
        setHintMounted(true);
        window.requestAnimationFrame(() => setHintVisible(true));
    }, []);

    const handleSingleTap = useCallback(() => {
        advance.setPlaying(!advance.playing);
    }, [advance]);

    const handleDoubleTap = useCallback(() => {
        setZoom((prev) => {
            const next = prev === ZOOM_OUT ? ZOOM_IN : ZOOM_OUT;
            if (next > ZOOM_OUT) {
                wasPlayingBeforeZoomRef.current = advance.playing;
                advance.setPlaying(false);
            } else {
                advance.setPlaying(wasPlayingBeforeZoomRef.current);
            }
            return next;
        });
    }, [advance]);

    const gesture = useGestureRouter({
        onSingleTap: handleSingleTap,
        onDoubleTap: handleDoubleTap,
        enabled: count > 0,
    });

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        dismissHint();
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointersRef.current.size >= 2) {
            const points = [...pointersRef.current.values()];
            const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
            pinchStartRef.current = { dist, zoom };
            wasPlayingBeforeZoomRef.current = advance.playing;
            advance.setPlaying(false);
            setIsPinching(true);
            gesture.reset();
            swipedRef.current = false;
            pointerStartRef.current = null;
            panStartRef.current = null;
            return;
        }

        if (zoom > ZOOM_OUT) {
            panStartRef.current = {
                px: e.clientX,
                py: e.clientY,
                panX: pan.x,
                panY: pan.y,
            };
            return;
        }

        swipedRef.current = false;
        pointerStartRef.current = { x: e.clientX, y: e.clientY };
        gesture.onPointerDown(e);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!pointersRef.current.has(e.pointerId)) return;
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (isPinching && pinchStartRef.current && pointersRef.current.size >= 2) {
            const points = [...pointersRef.current.values()];
            const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
            const ratio = dist / pinchStartRef.current.dist;
            const next = Math.min(ZOOM_MAX, Math.max(0.7, pinchStartRef.current.zoom * ratio));
            setZoom(next);
            return;
        }

        if (isPinching) return;

        if (panStartRef.current && zoom > ZOOM_OUT) {
            const dx = e.clientX - panStartRef.current.px;
            const dy = e.clientY - panStartRef.current.py;
            const slot = carouselRef.current;
            if (slot) {
                const maxX = (slot.clientWidth * (zoom - 1)) / 2;
                const maxY = (slot.clientHeight * (zoom - 1)) / 2;
                const newX = Math.max(-maxX, Math.min(maxX, panStartRef.current.panX + dx));
                const newY = Math.max(-maxY, Math.min(maxY, panStartRef.current.panY + dy));
                setPan({ x: newX, y: newY });
            }
            return;
        }

        if (!swipedRef.current && pointerStartRef.current) {
            const dx = e.clientX - pointerStartRef.current.x;
            const dy = e.clientY - pointerStartRef.current.y;
            if (Math.hypot(dx, dy) > SWIPE_TOLERANCE_PX) {
                swipedRef.current = true;
                wasPlayingBeforeSwipeRef.current = advance.playing;
                advance.setPlaying(false);
            }
        }
        gesture.onPointerMove(e);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        pointersRef.current.delete(e.pointerId);

        if (isPinching) {
            if (pointersRef.current.size < 2) {
                setIsPinching(false);
                pinchStartRef.current = null;
                setZoom((prev) => {
                    if (prev < ZOOM_SNAP_THRESHOLD) {
                        advance.setPlaying(wasPlayingBeforeZoomRef.current);
                        return ZOOM_OUT;
                    }
                    return Math.min(ZOOM_MAX, prev);
                });
            }
            return;
        }

        if (panStartRef.current) {
            panStartRef.current = null;
            return;
        }

        const wasSwipe = swipedRef.current;
        gesture.onPointerUp(e);
        pointerStartRef.current = null;
        if (wasSwipe && wasPlayingBeforeSwipeRef.current) {
            window.setTimeout(() => advance.setPlaying(true), SWIPE_RESUME_DELAY_MS);
        }
    };

    const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
        pointersRef.current.delete(e.pointerId);
        if (isPinching && pointersRef.current.size < 2) {
            setIsPinching(false);
            pinchStartRef.current = null;
            setZoom(ZOOM_OUT);
            advance.setPlaying(wasPlayingBeforeZoomRef.current);
        }
        gesture.onPointerCancel(e);
        pointerStartRef.current = null;
        panStartRef.current = null;
        swipedRef.current = false;
    };

    const handleClose = () => {
        navigate(ROUTES.PATH.TRIP.ROOT(tripKey!), {
            state: { lastLoactedPinPointId: pinPointId },
        });
    };

    if (isLoading || !result) {
        return (
            <div css={pageContainer}>
                <Indicator />
            </div>
        );
    }

    if (!result.success || count === 0) {
        return (
            <div css={pageContainer}>
                <button css={topRightCloseButton} onClick={handleClose} aria-label='닫기'>
                    <X size={18} color={ACCENT} strokeWidth={2.4} />
                </button>
                <div css={emptyWrap}>
                    <div css={emptyIcon}>
                        <ImageOff color='white' />
                    </div>
                    <h3 css={emptyTitle}>등록된 사진이 없어요</h3>
                    <p css={emptyDesc}>{`이 핀포인트에 등록된\n사진을 찾을 수 없어요`}</p>
                </div>
            </div>
        );
    }

    const time = activeImage?.recordDate.split('T')[1]?.slice(0, 5) ?? '';
    const carouselLocked = zoom !== ZOOM_OUT || isPinching;
    const chromeVisible = zoom <= 1.05 && !isPinching;

    return (
        <div css={pageContainer}>
            <div
                ref={carouselRef}
                css={carouselStyle(carouselLocked)}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
            >
                {images.map((img, i) => (
                    <div key={img.mediaFileId} ref={(el) => (imageRefs.current[i] = el)} data-index={i} css={slotStyle}>
                        <img
                            src={img.mediaLink}
                            alt=''
                            css={photoImage}
                            style={{
                                transform:
                                    i === advance.index
                                        ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
                                        : 'scale(1)',
                            }}
                            draggable={false}
                        />
                    </div>
                ))}
            </div>

            <div css={topGradient(chromeVisible)} aria-hidden />
            <div css={bottomGradient(chromeVisible)} aria-hidden />

            <header css={topChrome(chromeVisible)}>
                <div css={indexPill}>
                    <span css={indexPillDot(advance.playing)} aria-hidden />
                    <span css={indexPillText}>
                        {advance.index + 1} / {count}
                    </span>
                </div>
                <div css={topRightGroup}>
                    <button type='button' css={iconButton(chromeVisible)} onClick={showHint} aria-label='도움말'>
                        <Info size={17} color={ACCENT} strokeWidth={2.4} />
                    </button>
                    <button type='button' css={iconButton(chromeVisible)} onClick={handleClose} aria-label='닫기'>
                        <X size={17} color={ACCENT} strokeWidth={2.4} />
                    </button>
                </div>
            </header>

            <div css={captionWrap(chromeVisible)}>
                <MapPin size={11} color={ACCENT} fill={ACCENT} strokeWidth={0} />
                {placeName && <span css={captionText}>{placeName.toUpperCase()}</span>}
                {placeName && <span css={captionDot}>·</span>}
                <span css={captionTime}>{time}</span>
            </div>

            {count > 1 && (
                <div css={thumbStripWrap(chromeVisible)}>
                    {images.map((img, i) => (
                        <button
                            key={img.mediaFileId}
                            type='button'
                            ref={(el) => (thumbRefs.current[i] = el)}
                            onClick={(e) => {
                                e.stopPropagation();
                                advance.goTo(i);
                            }}
                            css={thumbButton(i === advance.index)}
                            aria-label={`사진 ${i + 1}로 이동`}
                            aria-current={i === advance.index}
                        >
                            <img src={img.mediaLink} alt='' css={thumbImage} />
                        </button>
                    ))}
                </div>
            )}

            {hintMounted && (
                <div css={hintToast(hintVisible)} aria-hidden>
                    <div css={hintRow}>
                        <span css={hintBadge}>↔</span>
                        <span>좌우 스와이프로 이동</span>
                    </div>
                    <div css={hintRow}>
                        <span css={hintBadge}>탭</span>
                        <span>한 번 탭 = 일시정지</span>
                    </div>
                    <div css={hintRow}>
                        <span css={hintBadge}>⊕</span>
                        <span>더블탭 · 핀치로 확대</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const pageContainer = css`
    position: relative;
    width: 100%;
    height: 100dvh;
    overflow: hidden;
    background: #000;
    color: #fff;
    user-select: none;
    overscroll-behavior: contain;
`;

const carouselStyle = (locked: boolean) => css`
    position: absolute;
    inset: 0;
    display: flex;
    overflow-x: ${locked ? 'hidden' : 'auto'};
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    overscroll-behavior: contain;
    background: ${LETTERBOX_BG};
    touch-action: ${locked ? 'none' : 'pan-x'};
    scrollbar-width: none;
    -ms-overflow-style: none;
    z-index: 1;

    &::-webkit-scrollbar {
        display: none;
    }
`;

const slotStyle = css`
    flex: 0 0 100%;
    width: 100%;
    height: 100%;
    scroll-snap-align: center;
    scroll-snap-stop: always;
    position: relative;
    display: grid;
    place-items: center;
    background: ${LETTERBOX_BG};
`;

const photoImage = css`
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    pointer-events: none;
    -webkit-user-drag: none;
    transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
`;

const topGradient = (shown: boolean) => css`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 130px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.5), transparent);
    z-index: 3;
    pointer-events: none;
    opacity: ${shown ? 1 : 0};
    transition: opacity 200ms ease;
`;

const bottomGradient = (shown: boolean) => css`
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 220px;
    background: linear-gradient(0deg, rgba(0, 0, 0, 0.85), transparent);
    z-index: 3;
    pointer-events: none;
    opacity: ${shown ? 1 : 0};
    transition: opacity 200ms ease;
`;

const topChrome = (shown: boolean) => css`
    position: absolute;
    top: max(20px, env(safe-area-inset-top, 0px));
    padding-top: 16px;
    left: 16px;
    right: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 10;
    pointer-events: none;
    opacity: ${shown ? 1 : 0};
    transition: opacity 200ms ease;
`;

const indexPill = css`
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(10px) saturate(180%);
    -webkit-backdrop-filter: blur(10px) saturate(180%);
    border-radius: 100px;
    padding: 5px 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.4px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    pointer-events: none;
`;

const indexPillDot = (playing: boolean) => css`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${playing ? ACCENT : '#888'};
    transition: background 220ms ease;
`;

const indexPillText = css`
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.92);
`;

const closeButtonBase = css`
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
    transition:
        transform 220ms cubic-bezier(0.32, 0.72, 0, 1),
        background 200ms ease;
    -webkit-tap-highlight-color: transparent;

    &:active {
        transform: scale(0.94);
        background: rgba(10, 10, 12, 0.75);
    }
`;

const iconButton = (shown: boolean) => css`
    ${closeButtonBase};
    pointer-events: ${shown ? 'auto' : 'none'};
`;

const topRightGroup = css`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const topRightCloseButton = css`
    ${closeButtonBase};
    position: absolute;
    top: max(20px, env(safe-area-inset-top, 0px));
    margin-top: 16px;
    right: 16px;
    z-index: 10;
`;

const captionWrap = (shown: boolean) => css`
    position: absolute;
    left: 24px;
    right: 24px;
    bottom: 130px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.6px;
    color: rgba(255, 255, 255, 0.85);
    z-index: 8;
    pointer-events: none;
    opacity: ${shown ? 1 : 0};
    transition: opacity 200ms ease;
`;

const captionText = css`
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 70%;
`;

const captionDot = css`
    opacity: 0.4;
`;

const captionTime = css`
    font-variant-numeric: tabular-nums;
`;

const thumbStripWrap = (shown: boolean) => css`
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    padding: 8px 20px;
    display: flex;
    gap: 6px;
    overflow-x: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    -ms-overflow-style: none;
    z-index: 10;
    align-items: center;
    opacity: ${shown ? 1 : 0};
    pointer-events: ${shown ? 'auto' : 'none'};
    transition: opacity 200ms ease;

    &::-webkit-scrollbar {
        display: none;
    }
`;

const thumbButton = (isActive: boolean) => css`
    flex-shrink: 0;
    width: ${isActive ? 64 : 44}px;
    height: ${isActive ? 64 : 44}px;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    border-radius: 8px;
    overflow: hidden;
    outline: ${isActive ? `2px solid ${ACCENT}` : 'none'};
    outline-offset: 0;
    opacity: ${isActive ? 1 : 0.5};
    filter: ${isActive ? 'none' : 'saturate(0.7)'};
    transition:
        width 250ms ease,
        height 250ms ease,
        opacity 220ms ease,
        outline 200ms ease,
        filter 220ms ease,
        transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
    background: transparent;
    -webkit-tap-highlight-color: transparent;

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

const hintToast = (visible: boolean) => css`
    position: absolute;
    top: 50%;
    left: 50%;
    padding: 16px 22px;
    border-radius: 18px;
    background: rgba(0, 0, 0, 0.68);
    backdrop-filter: blur(18px) saturate(180%);
    -webkit-backdrop-filter: blur(18px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.14);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.2px;
    color: rgba(255, 255, 255, 0.95);
    display: flex;
    flex-direction: column;
    gap: 10px;
    text-align: left;
    z-index: 20;
    pointer-events: none;
    opacity: ${visible ? 1 : 0};
    transform: translate(-50%, ${visible ? '-50%' : '-46%'});
    transition:
        opacity 360ms cubic-bezier(0.22, 1, 0.36, 1),
        transform 360ms cubic-bezier(0.22, 1, 0.36, 1);
    box-shadow: 0 12px 30px -12px rgba(0, 0, 0, 0.5);
`;

const hintRow = css`
    display: flex;
    align-items: center;
    gap: 10px;
    white-space: nowrap;
`;

const hintBadge = css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    height: 22px;
    padding: 0 7px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.12);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0;
`;

const emptyWrap = css`
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: #fff;
`;

const emptyIcon = css`
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(255, 255, 255, 0.12);
`;

const emptyTitle = css`
    margin-top: 18px;
    color: #fff;
    font-size: 18px;
    font-weight: bold;
`;

const emptyDesc = css`
    margin-top: 8px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 15px;
    line-height: 21px;
    text-align: center;
    white-space: pre-line;
`;

export default ImageByPinpointPage;
