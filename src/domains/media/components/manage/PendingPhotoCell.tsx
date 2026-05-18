import { css, keyframes } from '@emotion/react';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';

interface PendingPhotoCellProps {
    previewUrl: string;
}

const PendingPhotoCell = ({ previewUrl }: PendingPhotoCellProps) => (
    <div css={cellStyle} aria-label='업로드 중인 사진'>
        <img src={previewUrl} alt='' css={imgStyle} />
        <div css={cornerBadgeStyle}>
            <div css={spinnerStyle} />
        </div>
        <div css={progressBarStyle}>
            <div css={progressFillStyle} />
        </div>
    </div>
);

const spin = keyframes`
    to { transform: rotate(360deg); }
`;

const slide = keyframes`
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
`;

const cellStyle = css`
    position: relative;
    aspect-ratio: 1 / 1;
    width: 100%;
    border-radius: ${MANAGE_TOKENS.radius.pill}px;
    overflow: hidden;
    background: ${MANAGE_TOKENS.bg};
`;

const imgStyle = css`
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
`;

const cornerBadgeStyle = css`
    position: absolute;
    top: 6px;
    right: 6px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: grid;
    place-items: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28);
`;

const spinnerStyle = css`
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.35);
    border-top-color: #fff;
    animation: ${spin} 700ms linear infinite;
`;

const progressBarStyle = css`
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.25);
    overflow: hidden;
`;

const progressFillStyle = css`
    width: 50%;
    height: 100%;
    background: ${MANAGE_TOKENS.accent};
    box-shadow: 0 0 8px rgba(0, 113, 227, 0.6);
    animation: ${slide} 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
`;

export default PendingPhotoCell;
