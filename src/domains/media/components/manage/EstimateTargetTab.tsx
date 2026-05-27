import { css } from '@emotion/react';
import { Check } from 'lucide-react';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { MediaFile } from '@/domains/media/types';
import { extractTimeOfDay } from '@/domains/media/utils';
import { IMAGE_PLACEHOLDER } from '@/shared/constants/image';

interface EstimateTargetTabProps {
    photo: MediaFile;
    active: boolean;
    done: boolean;
    showTime?: boolean;
    onClick: () => void;
}

const EstimateTargetTab = ({ photo, active, done, showTime = true, onClick }: EstimateTargetTabProps) => (
    <button type='button' data-target-id={photo.mediaFileId} css={tabStyle(active)} onClick={onClick}>
        <img
            src={photo.mediaLink}
            alt=''
            css={imgStyle}
            loading='lazy'
            onError={(e) => {
                const img = e.currentTarget;
                if (img.dataset.fallback === '1') return;
                img.dataset.fallback = '1';
                img.src = IMAGE_PLACEHOLDER;
            }}
        />
        {showTime && <span css={timeStyle}>{extractTimeOfDay(photo.recordDate) || '—'}</span>}
        {done && (
            <span css={doneStyle}>
                <Check size={10} strokeWidth={3.4} color='#fff' />
            </span>
        )}
    </button>
);

const tabStyle = (active: boolean) => css`
    position: relative;
    flex-shrink: 0;
    /* 실제 width/height 차이로 시각 hierarchy. transform: scale은 인접 tab과 겹치거나
       overflow-x: auto에 클리핑되는 문제가 있어 사용하지 않음. */
    width: ${active ? '88px' : '52px'};
    height: ${active ? '108px' : '64px'};
    align-self: center;
    padding: 0;
    background: transparent;
    border: ${active ? `3px solid ${MANAGE_TOKENS.accent}` : '2px solid transparent'};
    border-radius: ${active ? '12px' : '8px'};
    overflow: hidden;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    opacity: ${active ? 1 : 0.55};
    box-shadow: ${active ? '0 10px 26px rgba(0, 113, 227, 0.35)' : 'none'};
    z-index: ${active ? 1 : 0};
    transition:
        width 260ms cubic-bezier(0.34, 1.56, 0.64, 1),
        height 260ms cubic-bezier(0.34, 1.56, 0.64, 1),
        border-radius 220ms ease,
        opacity 220ms ease,
        box-shadow 240ms ease,
        border-color 200ms ease;
    will-change: width, height;
`;

const imgStyle = css`
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
`;

const timeStyle = css`
    position: absolute;
    bottom: 4px;
    left: 4px;
    font-size: 9px;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
    font-family: ${MANAGE_TOKENS.font};
    font-variant-numeric: tabular-nums;
`;

const doneStyle = css`
    position: absolute;
    top: 4px;
    right: 4px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: ${MANAGE_TOKENS.success};
    display: grid;
    place-items: center;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
`;

export default EstimateTargetTab;
