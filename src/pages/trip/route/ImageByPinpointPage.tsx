import { useEffect, useMemo, useRef, useState } from 'react';

import { css } from '@emotion/react';
import { ImageOff, MapPin, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { useMediaByPinPoint } from '@/domains/media/hooks/queries';
import { useAutoAdvance } from '@/domains/media/hooks/useAutoAdvance';
import { useAutoHideStrip } from '@/domains/media/hooks/useAutoHideStrip';
import { useDoubleTapZoom } from '@/domains/media/hooks/useDoubleTapZoom';
import { getNeighborhoodFromLocation } from '@/libs/utils/map';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import { ROUTES } from '@/shared/constants/route';
import { useMapScript } from '@/shared/hooks/useMapScript';

const PER_PHOTO_MS = 5000;
const STRIP_HIDE_AFTER_MS = 3000;
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
    const { zoom, handleTap, resetZoom } = useDoubleTapZoom((nextZoom) => {
        advance.setPlaying(nextZoom === 1);
    });
    const { shown: stripShown, notifyActivity } = useAutoHideStrip(advance.index, STRIP_HIDE_AFTER_MS);

    const stripRef = useRef<HTMLDivElement | null>(null);
    const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const [placeName, setPlaceName] = useState<string>('');

    const activeImage = images[advance.index];

    useEffect(() => {
        if (!images.length || !isMapScriptLoaded) return;
        const first = images[0];
        getNeighborhoodFromLocation({ latitude: first.latitude, longitude: first.longitude })
            .then(setPlaceName)
            .catch(() => setPlaceName(''));
    }, [images, isMapScriptLoaded]);

    useEffect(() => {
        const el = thumbRefs.current[advance.index];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, [advance.index]);

    useEffect(() => {
        resetZoom();
    }, [advance.index, resetZoom]);

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

    const time = activeImage.recordDate.split('T')[1]?.slice(0, 5) ?? '';

    return (
        <div css={pageContainer} onPointerMove={notifyActivity} onTouchStart={notifyActivity}>
            {/* Photo area (letterbox, contain fit, double-tap zoom) */}
            <div
                css={photoArea}
                onClick={handleTap}
                role='img'
                aria-label={`핀포인트 사진 ${advance.index + 1} / ${count}`}
            >
                <div key={advance.index} css={photoInner} style={{ transform: `scale(${zoom})` }}>
                    <img src={activeImage.mediaLink} alt='' css={photoImage} draggable={false} />
                </div>
            </div>

            {/* Prev / next tap zones */}
            {count > 1 && (
                <>
                    <button
                        type='button'
                        css={[tapZoneBase, tapZoneLeft]}
                        onClick={(e) => {
                            e.stopPropagation();
                            advance.prev();
                        }}
                        aria-label='이전 사진'
                    />
                    <button
                        type='button'
                        css={[tapZoneBase, tapZoneRight]}
                        onClick={(e) => {
                            e.stopPropagation();
                            advance.next();
                        }}
                        aria-label='다음 사진'
                    />
                </>
            )}

            {/* Gradients */}
            <div css={topGradient} aria-hidden />
            <div css={bottomGradient} aria-hidden />

            {/* Top chrome */}
            <header css={topChrome}>
                <div css={indexPill}>
                    <span css={indexPillDot(advance.playing)} aria-hidden />
                    <span css={indexPillText}>
                        {advance.index + 1} / {count}
                    </span>
                </div>
                <button type='button' css={closeButton} onClick={handleClose} aria-label='닫기'>
                    <X size={17} color={ACCENT} strokeWidth={2.4} />
                </button>
            </header>

            {/* Caption */}
            <div css={captionWrap(stripShown)}>
                <MapPin size={11} color={ACCENT} fill={ACCENT} strokeWidth={0} />
                {placeName && <span css={captionText}>{placeName.toUpperCase()}</span>}
                {placeName && <span css={captionDot}>·</span>}
                <span css={captionTime}>{time}</span>
            </div>

            {/* Auto-hide thumbnail strip */}
            {count > 1 && stripShown && (
                <div css={thumbStrip} ref={stripRef}>
                    {images.map((img, i) => {
                        const isActive = i === advance.index;
                        return (
                            <button
                                key={img.mediaFileId}
                                type='button'
                                ref={(el) => (thumbRefs.current[i] = el)}
                                onClick={() => advance.goTo(i)}
                                css={thumbButton(isActive)}
                                aria-label={`사진 ${i + 1}로 이동`}
                                aria-current={isActive}
                            >
                                <img src={img.mediaLink} alt='' css={thumbImage} />
                            </button>
                        );
                    })}
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
    touch-action: manipulation;
    overscroll-behavior: contain;
`;

const photoArea = css`
    position: absolute;
    inset: 0;
    background: ${LETTERBOX_BG};
    cursor: pointer;
    z-index: 1;
`;

const photoInner = css`
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
    animation: ibpcFade 320ms ease-out;

    @keyframes ibpcFade {
        0% {
            opacity: 0;
        }
        100% {
            opacity: 1;
        }
    }
`;

const photoImage = css`
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    pointer-events: none;
    -webkit-user-drag: none;
`;

const tapZoneBase = css`
    position: absolute;
    top: 90px;
    bottom: 180px;
    width: 32%;
    z-index: 5;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &:focus-visible {
        outline: 2px solid rgba(255, 255, 255, 0.3);
        outline-offset: -4px;
    }
`;

const tapZoneLeft = css`
    left: 0;
`;

const tapZoneRight = css`
    right: 0;
`;

const topGradient = css`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 130px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.5), transparent);
    z-index: 3;
    pointer-events: none;
`;

const bottomGradient = css`
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 220px;
    background: linear-gradient(0deg, rgba(0, 0, 0, 0.85), transparent);
    z-index: 3;
    pointer-events: none;
`;

const topChrome = css`
    position: absolute;
    top: max(20px, env(safe-area-inset-top, 0px));
    padding-top: 16px;
    left: 16px;
    right: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 10;
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

const closeButton = css`
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

const topRightCloseButton = css`
    ${closeButton};
    position: absolute;
    top: max(20px, env(safe-area-inset-top, 0px));
    margin-top: 16px;
    right: 16px;
    z-index: 10;
`;

const captionWrap = (stripShown: boolean) => css`
    position: absolute;
    left: 24px;
    right: 24px;
    bottom: ${stripShown ? 130 : 50}px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.6px;
    color: rgba(255, 255, 255, 0.85);
    z-index: 8;
    transition: bottom 300ms ease;
    pointer-events: none;
`;

const captionText = css`
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 60%;
`;

const captionDot = css`
    opacity: 0.4;
`;

const captionTime = css`
    font-variant-numeric: tabular-nums;
`;

const thumbStrip = css`
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(28px + env(safe-area-inset-bottom, 0px));
    padding: 0 16px;
    display: flex;
    gap: 6px;
    overflow-x: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    -ms-overflow-style: none;
    z-index: 10;
    animation: ibpcStripIn 280ms ease-out;
    align-items: center;

    &::-webkit-scrollbar {
        display: none;
    }

    @keyframes ibpcStripIn {
        0% {
            opacity: 0;
            transform: translateY(20px);
        }
        100% {
            opacity: 1;
            transform: translateY(0);
        }
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
