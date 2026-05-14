import { useCallback, useState } from 'react';

import { css } from '@emotion/react';

import { MediaFile } from '@/domains/media/types';

interface ImageItemProps {
    image: MediaFile;
    isActive?: boolean;
    onImageLoad?: () => void;
}

const ImageItem = ({ image, isActive = false, onImageLoad }: ImageItemProps) => {
    const [isLoading, setIsLoading] = useState(true);

    const handleImageLoad = useCallback(() => {
        setIsLoading(false);
        onImageLoad?.();
    }, [onImageLoad]);

    return (
        <div css={imageItemStyle(isActive)}>
            <img src={image.mediaLink} alt={`이미지 ${image.mediaFileId}`} onLoad={handleImageLoad} css={imageStyle} />
            {!isLoading && <span css={timeStampStyle}>{image.recordDate.split('T')[1].slice(0, 5)}</span>}
        </div>
    );
};

const imageItemStyle = (isActive: boolean) => css`
    position: relative;
    width: 100%;
    border-radius: 10px;
    overflow: hidden;
    outline: ${isActive ? '2px solid #0071e3' : 'none'};
    outline-offset: -1px;
    transition: outline 150ms;
`;

const imageStyle = css`
    width: 100%;
    display: block;
`;

const timeStampStyle = css`
    position: absolute;
    bottom: 8px;
    left: 8px;
    font-size: 10px;
    color: #fff;
    font-weight: 600;
    letter-spacing: 0.4px;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
`;

export default ImageItem;
