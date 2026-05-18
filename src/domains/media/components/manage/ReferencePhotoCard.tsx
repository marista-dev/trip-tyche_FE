import { css } from '@emotion/react';
import { Check, Clock, MapPin } from 'lucide-react';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';

interface ReferencePhotoCardProps {
    mediaLink: string;
    primaryLabel: string;
    secondaryLabel: string;
    metaLabel: string;
    metaIcon: 'time' | 'location';
    selected: boolean;
    onClick: () => void;
}

const ReferencePhotoCard = ({
    mediaLink,
    primaryLabel,
    secondaryLabel,
    metaLabel,
    metaIcon,
    selected,
    onClick,
}: ReferencePhotoCardProps) => (
    <div css={cardStyle(selected)} onClick={onClick}>
        <div css={thumbStyle}>
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
                <span css={metaLabelStyle}>{metaLabel}</span>
            </div>
        </div>
        <span css={radioStyle(selected)}>{selected && <Check size={11} strokeWidth={3.4} color='#fff' />}</span>
    </div>
);

const cardStyle = (selected: boolean) => css`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    background: ${MANAGE_TOKENS.card};
    border-radius: 12px;
    border: ${selected ? `2px solid ${MANAGE_TOKENS.accent}` : `1px solid ${MANAGE_TOKENS.border}`};
    box-shadow: ${selected ? '0 4px 14px rgba(0,113,227,0.12)' : 'none'};
    cursor: pointer;
    transition: all 180ms ease;
    font-family: ${MANAGE_TOKENS.font};
    -webkit-tap-highlight-color: transparent;
    &:active {
        opacity: 0.9;
    }
`;

const thumbStyle = css`
    width: 64px;
    height: 64px;
    flex-shrink: 0;
    border-radius: 8px;
    overflow: hidden;
    background: ${MANAGE_TOKENS.bg};
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
