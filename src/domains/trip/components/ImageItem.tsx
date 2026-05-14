import { useCallback, useState } from 'react';

import { css } from '@emotion/react';

import { MediaFile } from '@/domains/media/types';

interface ImageItemProps {
    image: MediaFile;
    onImageLoad?: () => void;
}

const ImageItem = ({ image, onImageLoad }: ImageItemProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [naturalRatio, setNaturalRatio] = useState<number | null>(null);

    const handleImageLoad = useCallback(
        (e: React.SyntheticEvent<HTMLImageElement>) => {
            const target = e.currentTarget;
            if (target.naturalWidth && target.naturalHeight) {
                setNaturalRatio(target.naturalWidth / target.naturalHeight);
            }
            setIsLoading(false);
            onImageLoad?.();
        },
        [onImageLoad],
    );

    const time = image.recordDate.split('T')[1]?.slice(0, 5) ?? '';

    return (
        <div css={imageItemStyle(naturalRatio)}>
            <img src={image.mediaLink} alt={`이미지 ${image.mediaFileId}`} onLoad={handleImageLoad} css={imageStyle} />
            {!isLoading && (
                <div css={timeStampWrap}>
                    <span css={timeStampStyle}>{time}</span>
                </div>
            )}
        </div>
    );
};

const imageItemStyle = (ratio: number | null) => css`
    position: relative;
    max-width: 100%;
    max-height: 100%;
    ${ratio ? `aspect-ratio: ${ratio};` : ''}
    border-radius: 14px;
    overflow: hidden;
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.4) inset,
        0 8px 24px -12px rgba(15, 23, 42, 0.28),
        0 2px 8px -4px rgba(15, 23, 42, 0.08);
    transform: translateZ(0);
    background: #0a0a0a;
`;

const imageStyle = css`
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    display: block;
    object-fit: contain;
`;

const timeStampWrap = css`
    position: absolute;
    bottom: 12px;
    right: 14px;
    pointer-events: none;
    z-index: 2;

    &::before {
        content: '';
        position: absolute;
        inset: -10px -14px;
        background: radial-gradient(ellipse at right bottom, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0) 65%);
        z-index: 0;
        filter: blur(2px);
    }
`;

const timeStampStyle = css`
    position: relative;
    z-index: 1;
    font-family: 'DS-DIGII', sans-serif;
    font-weight: bold;
    font-style: italic;
    font-size: 22px;
    line-height: 1;
    letter-spacing: 1.8px;
    color: #ffb15a;
    font-variant-numeric: tabular-nums;
    text-shadow:
        0 0 6px rgba(255, 155, 55, 0.85),
        0 0 14px rgba(255, 130, 50, 0.55),
        0 0 22px rgba(255, 110, 30, 0.35),
        0 2px 4px rgba(0, 0, 0, 0.45);
`;

export default ImageItem;
