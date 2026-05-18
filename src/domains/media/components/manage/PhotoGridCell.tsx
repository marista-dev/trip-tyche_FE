import { css } from '@emotion/react';
import { Check } from 'lucide-react';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { MediaFile } from '@/domains/media/types';
import { extractTimeOfDay } from '@/domains/media/utils';

interface PhotoGridCellProps {
    photo: MediaFile;
    selected: boolean;
    selectMode: boolean;
    showTime?: boolean;
    onToggle: (photo: MediaFile) => void;
}

const PhotoGridCell = ({ photo, selected, selectMode, showTime = false, onToggle }: PhotoGridCellProps) => (
    <button type='button' css={cellStyle(selected)} onClick={() => onToggle(photo)}>
        <img src={photo.mediaLink} alt='' css={imgStyle} loading='lazy' />
        {showTime && !selectMode && <span css={timeBadgeStyle}>{extractTimeOfDay(photo.recordDate)}</span>}
        {(selected || selectMode) && (
            <span css={radioStyle(selected)}>{selected && <Check size={10} strokeWidth={3.4} color='#fff' />}</span>
        )}
    </button>
);

const cellStyle = (selected: boolean) => css`
    position: relative;
    aspect-ratio: 1 / 1;
    width: 100%;
    border: none;
    padding: 0;
    background: transparent;
    border-radius: ${MANAGE_TOKENS.radius.pill}px;
    overflow: hidden;
    cursor: pointer;
    transform: ${selected ? 'scale(0.93)' : 'scale(1)'};
    transition: transform 180ms cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
`;

const imgStyle = css`
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
`;

const timeBadgeStyle = css`
    position: absolute;
    bottom: 3px;
    left: 5px;
    font-size: 9px;
    font-weight: 600;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
    letter-spacing: 0.3px;
    font-variant-numeric: tabular-nums;
`;

const radioStyle = (selected: boolean) => css`
    position: absolute;
    top: 5px;
    right: 5px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: ${selected ? MANAGE_TOKENS.accent : 'rgba(255,255,255,0.45)'};
    border: 2px solid #fff;
    display: grid;
    place-items: center;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
    transition: background 150ms ease;
`;

export default PhotoGridCell;
