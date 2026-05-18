import { css } from '@emotion/react';
import { Check, Clock, MapPin } from 'lucide-react';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { useReverseGeocode } from '@/shared/hooks/useReverseGeocode';

interface ReferencePhotoCardProps {
    mediaLink: string;
    primaryLabel: string;
    secondaryLabel: string;
    metaIcon: 'time' | 'location';
    metaLabel?: string;
    // metaIcon === 'location' 일 때 lat/lng 주면 역지오코딩으로 주소 표시
    latitude?: number;
    longitude?: number;
    selected: boolean;
    onClick: () => void;
}

const ReferencePhotoCard = ({
    mediaLink,
    primaryLabel,
    secondaryLabel,
    metaIcon,
    metaLabel,
    latitude,
    longitude,
    selected,
    onClick,
}: ReferencePhotoCardProps) => {
    const shouldGeocode = metaIcon === 'location' && latitude !== undefined && longitude !== undefined;
    const { address, isLoading: isGeocoding } = useReverseGeocode(
        shouldGeocode ? latitude! : 0,
        shouldGeocode ? longitude! : 0,
    );

    const displayMeta = shouldGeocode ? (isGeocoding && !address ? '위치 확인 중...' : address) : (metaLabel ?? '');

    return (
        <div css={cardStyle(selected)} onClick={onClick}>
            <div css={thumbStyle(selected)}>
                <img src={mediaLink} alt='' css={thumbImgStyle} loading='lazy' />
            </div>
            <div css={infoStyle}>
                <div css={primaryRowStyle}>
                    <span css={primaryStyle}>{primaryLabel}</span>
                    <span css={secondaryStyle}>{secondaryLabel}</span>
                </div>
                <div css={metaRowStyle}>
                    {metaIcon === 'time' ? (
                        <Clock size={11} strokeWidth={2.2} color={MANAGE_TOKENS.accent} />
                    ) : (
                        <MapPin size={11} strokeWidth={2.2} color={MANAGE_TOKENS.accent} />
                    )}
                    <span css={metaLabelStyle}>{displayMeta}</span>
                </div>
            </div>
            <span css={radioStyle(selected)}>{selected && <Check size={11} strokeWidth={3.4} color='#fff' />}</span>
        </div>
    );
};

const cardStyle = (selected: boolean) => css`
    display: flex;
    align-items: center;
    gap: 14px;
    padding: ${selected ? '18px 18px' : '10px'};
    margin: ${selected ? '10px 0' : '0'};
    background: ${MANAGE_TOKENS.card};
    border-radius: 16px;
    border: ${selected ? `3px solid ${MANAGE_TOKENS.accent}` : `1px solid ${MANAGE_TOKENS.border}`};
    box-shadow: ${selected
        ? '0 22px 44px rgba(0,113,227,0.32), 0 0 0 6px rgba(0,113,227,0.12)'
        : '0 1px 0 rgba(0,0,0,0.02)'};
    cursor: pointer;
    transform: ${selected ? 'scale(1.08) translateY(-2px)' : 'scale(1)'};
    transform-origin: center;
    transition:
        transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1),
        padding 260ms cubic-bezier(0.34, 1.56, 0.64, 1),
        margin 260ms cubic-bezier(0.34, 1.56, 0.64, 1),
        box-shadow 240ms ease,
        border-color 200ms ease,
        border-width 200ms ease;
    font-family: ${MANAGE_TOKENS.font};
    -webkit-tap-highlight-color: transparent;
    will-change: transform;
    z-index: ${selected ? 2 : 1};
    position: relative;
    &:active {
        transform: ${selected ? 'scale(1.08) translateY(-2px)' : 'scale(0.97)'};
    }
`;

const thumbStyle = (selected: boolean) => css`
    width: ${selected ? '96px' : '64px'};
    height: ${selected ? '96px' : '64px'};
    flex-shrink: 0;
    border-radius: ${selected ? '14px' : '8px'};
    overflow: hidden;
    background: ${MANAGE_TOKENS.bg};
    box-shadow: ${selected ? '0 6px 16px rgba(0,0,0,0.18)' : 'none'};
    transition:
        width 280ms cubic-bezier(0.34, 1.56, 0.64, 1),
        height 280ms cubic-bezier(0.34, 1.56, 0.64, 1),
        border-radius 240ms ease,
        box-shadow 220ms ease;
`;

const thumbImgStyle = css`
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
`;

const infoStyle = css`
    flex: 1;
    min-width: 0;
`;

const primaryRowStyle = css`
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 3px;
`;

const primaryStyle = css`
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.2px;
    color: ${MANAGE_TOKENS.text.primary};
`;

const secondaryStyle = css`
    font-size: 10px;
    font-weight: 600;
    color: ${MANAGE_TOKENS.text.muted};
`;

const metaRowStyle = css`
    display: flex;
    align-items: center;
    gap: 3px;
`;

const metaLabelStyle = css`
    font-size: 12px;
    color: ${MANAGE_TOKENS.text.secondary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const radioStyle = (selected: boolean) => css`
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: ${selected ? MANAGE_TOKENS.accent : 'transparent'};
    border: 2px solid ${selected ? MANAGE_TOKENS.accent : 'rgba(0,0,0,0.2)'};
    display: grid;
    place-items: center;
    transition: all 150ms ease;
`;

export default ReferencePhotoCard;
