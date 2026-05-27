/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';

import type { MediaFileItem } from '@/domains/media/types';
import { translateFailureReason } from '@/domains/media/utils/translateFailureReason';

interface FailedImageCardProps {
    item: MediaFileItem;
    onRetry?: (mediaFileId: number) => void;
}

export const FailedImageCard = ({ item, onRetry }: FailedImageCardProps) => {
    return (
        <div css={containerStyle}>
            <img src={item.currentUrl} alt='' css={imgStyle} loading='lazy' />
            <div css={overlayStyle}>
                <p css={titleStyle}>처리 실패</p>
                <small css={reasonStyle}>{translateFailureReason(item.failureReason)}</small>
                {onRetry && (
                    <button type='button' css={retryButtonStyle} onClick={() => onRetry(item.mediaFileId)}>
                        다시 시도
                    </button>
                )}
            </div>
        </div>
    );
};

const containerStyle = css`
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 8px;
    background: #f4f4f5;
`;

const imgStyle = css`
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: brightness(0.5);
`;

const overlayStyle = css`
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: #fff;
    padding: 8px;
    text-align: center;
`;

const titleStyle = css`
    margin: 0;
    font-size: 13px;
    font-weight: 600;
`;

const reasonStyle = css`
    font-size: 11px;
    opacity: 0.8;
`;

const retryButtonStyle = css`
    margin-top: 8px;
    padding: 4px 12px;
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 4px;
    background: transparent;
    color: #fff;
    font-size: 12px;
    cursor: pointer;
    &:hover {
        background: rgba(255, 255, 255, 0.1);
    }
`;
