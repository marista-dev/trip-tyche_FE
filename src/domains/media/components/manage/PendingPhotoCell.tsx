import { css, keyframes } from '@emotion/react';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';

interface PendingPhotoCellProps {
    previewUrl: string;
}

const PendingPhotoCell = ({ previewUrl }: PendingPhotoCellProps) => (
    <div css={cellStyle} aria-label='업로드 중인 사진'>
        <img src={previewUrl} alt='' css={imgStyle} />
        <div css={overlayStyle}>
            <div css={spinnerStyle} />
        </div>
    </div>
);

const spin = keyframes`
    to { transform: rotate(360deg); }
`;

const pulse = keyframes`
    0%, 100% { opacity: 0.55; }
    50% { opacity: 0.35; }
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
    filter: brightness(0.85) saturate(0.9);
`;

const overlayStyle = css`
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.18);
    animation: ${pulse} 1.6s ease-in-out infinite;
`;

const spinnerStyle = css`
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2.5px solid rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
    animation: ${spin} 800ms linear infinite;
`;

export default PendingPhotoCell;
