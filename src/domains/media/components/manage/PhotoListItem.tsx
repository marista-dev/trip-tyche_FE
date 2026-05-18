import { css } from '@emotion/react';
import { AlertCircle, Check, ChevronRight } from 'lucide-react';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { MediaFile } from '@/domains/media/types';
import { extractTimeOfDay } from '@/domains/media/utils';

type ListTone = 'red' | 'amber';

interface PhotoListItemProps {
    photo: MediaFile;
    tone: ListTone;
    selected: boolean;
    isFirst: boolean;
    onToggle: (photo: MediaFile) => void;
    primaryLabel?: string;
    issueLabel: string;
}

const PhotoListItem = ({ photo, tone, selected, isFirst, onToggle, primaryLabel, issueLabel }: PhotoListItemProps) => {
    const accent = tone === 'red' ? MANAGE_TOKENS.destructive : MANAGE_TOKENS.warning;

    const labelText =
        primaryLabel ??
        (photo.recordDate
            ? `${photo.recordDate.split('T')[0].replaceAll('-', '.')} · ${extractTimeOfDay(photo.recordDate)}`
            : '날짜 없음');

    return (
        <div css={rowStyle(isFirst)} onClick={() => onToggle(photo)}>
            <span css={radioStyle(selected)}>{selected && <Check size={10} strokeWidth={3.4} color='#fff' />}</span>

            <div css={thumbStyle}>
                <img src={photo.mediaLink} alt='' css={thumbImgStyle} loading='lazy' />
            </div>

            <div css={infoStyle}>
                <p css={primaryStyle}>{labelText}</p>
                <p css={issueStyle(accent)}>
                    <AlertCircle size={11} strokeWidth={2.4} color={accent} />
                    {issueLabel}
                </p>
            </div>

            <ChevronRight size={14} strokeWidth={2} color='#ccc' />
        </div>
    );
};

const rowStyle = (isFirst: boolean) => css`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 6px;
    border-top: ${isFirst ? 'none' : `1px solid ${MANAGE_TOKENS.borderStrong}`};
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    &:active {
        background: rgba(0, 0, 0, 0.02);
    }
`;

const radioStyle = (selected: boolean) => css`
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border-radius: 50%;
    background: ${selected ? MANAGE_TOKENS.accent : 'transparent'};
    border: 2px solid ${selected ? MANAGE_TOKENS.accent : 'rgba(0,0,0,0.25)'};
    display: grid;
    place-items: center;
    transition: all 150ms ease;
`;

const thumbStyle = css`
    width: 56px;
    height: 56px;
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

const primaryStyle = css`
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: -0.2px;
    color: ${MANAGE_TOKENS.text.primary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const issueStyle = (accent: string) => css`
    margin: 2px 0 0;
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    font-weight: 600;
    color: ${accent};
`;

export default PhotoListItem;
