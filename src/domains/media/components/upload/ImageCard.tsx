import { useEffect, useState } from 'react';

import { css } from '@emotion/react';
import { Calendar, Map, CircleCheck } from 'lucide-react';

import { MediaFile } from '@/domains/media/types';
import { formatKoreanDate, formatKoreanTime } from '@/libs/utils/date';
import { hasValidDate } from '@/libs/utils/validate';
import { COLORS } from '@/shared/constants/style';
import { useReverseGeocode } from '@/shared/hooks/useReverseGeocode';

interface ImageCardProps {
    image: MediaFile;
    isSelected?: boolean;
    isTimeView?: boolean;
    onClick?: () => void;
    onLoad?: () => void;
}

const ImageCard = ({ image, isSelected = false, isTimeView = false, onClick, onLoad }: ImageCardProps) => {
    const { mediaFileId, mediaLink, latitude, longitude, recordDate } = image;

    const [isLoaded, setIsLoaded] = useState(false);
    const { address, isLoading } = useReverseGeocode(latitude, longitude);

    const date = hasValidDate(recordDate)
        ? isTimeView
            ? formatKoreanTime(recordDate)
            : formatKoreanDate(recordDate, true)
        : '날짜 정보 없음';
    const hasAddress = !!address;
    const hasDate = hasValidDate(recordDate);

    useEffect(() => {
        if (isLoaded && !isLoading) {
            onLoad?.();
        }
    }, [isLoaded, isLoading, onLoad]);

    return (
        <div key={mediaFileId} css={container} onClick={onClick}>
            <img src={mediaLink} alt='여행 사진 카드' css={imageStyle} onLoad={() => setIsLoaded(true)} />
            <div css={infoContainer}>
                <div css={iconStyle}>
                    <Map size={12} />
                    <p css={textStyle(hasAddress)}>{address}</p>
                </div>
                <div css={iconStyle}>
                    <Calendar size={12} />
                    <p css={textStyle(hasDate)}>{date}</p>
                </div>
            </div>

            {isSelected && (
                <div css={selectedOverlayStyle}>
                    <span css={checkIconStyle}>
                        <CircleCheck size={28} color={COLORS.PRIMARY} />
                    </span>
                </div>
            )}
        </div>
    );
};

const container = css`
    background-color: ${COLORS.BACKGROUND.WHITE};
    border-radius: 8px;
    border: 1px solid ${COLORS.BORDER};
    overflow: hidden;
    position: relative;
    pointer-events: none;
    user-select: none;
    box-shadow: rgba(0, 0, 0, 0.3) 8px 8px 16px -12px;
    cursor: pointer;
`;

const imageStyle = css`
    width: 100%;
    height: 120px;
    object-fit: cover;
`;

const infoContainer = css`
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const iconStyle = css`
    display: flex;
    align-items: center;
`;

const textStyle = (isValid: boolean) => css`
    margin-left: 4px;
    font-size: 12px;
    color: ${!isValid ? COLORS.TEXT.ERROR : '#374151'};
`;

const selectedOverlayStyle = css`
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: start;
    justify-content: end;
    padding: 8px;
    overflow: hidden;
`;

const checkIconStyle = css`
    border-radius: 50%;
    width: 28px;
    height: 28px;
    background-color: ${COLORS.BACKGROUND.WHITE};
`;

export default ImageCard;
