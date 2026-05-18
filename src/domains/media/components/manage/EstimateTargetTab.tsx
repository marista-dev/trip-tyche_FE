import { css } from '@emotion/react';
import { Check } from 'lucide-react';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { MediaFile } from '@/domains/media/types';
import { extractTimeOfDay } from '@/domains/media/utils';

interface EstimateTargetTabProps {
    photo: MediaFile;
    active: boolean;
    done: boolean;
    showTime?: boolean;
    onClick: () => void;
}

const EstimateTargetTab = ({ photo, active, done, showTime = true, onClick }: EstimateTargetTabProps) => (
    <button type='button' css={tabStyle(active)} onClick={onClick}>
        <img src={photo.mediaLink} alt='' css={imgStyle} loading='lazy' />
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
    width: 64px;
    height: 80px;
    padding: 0;
    background: transparent;
    border: ${active ? `2.5px solid ${MANAGE_TOKENS.accent}` : '2px solid transparent'};
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
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
