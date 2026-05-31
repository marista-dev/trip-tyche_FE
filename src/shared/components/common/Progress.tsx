import { css } from '@emotion/react';

import { COLORS } from '@/shared/constants/style';

type SizeType = 'lg' | 'sm';

interface ProgressProps {
    title: string;
    count: number;
    size?: SizeType;
}

const Progress = ({ title, count, size = 'sm' }: ProgressProps) => {
    return (
        <div css={container}>
            <div css={label(size)}>
                <span>{title}</span>
                <span>{count}%</span>
            </div>

            <div css={bar}>
                <div css={getStepProgressFillStyle(count, count === 100, size)} />
            </div>
        </div>
    );
};

const container = css`
    display: flex;
    flex-direction: column;
`;

const label = (size: SizeType) => css`
    display: flex;
    justify-content: space-between;
    font-size: ${size === 'sm' ? '12px' : '14px'};
    color: ${COLORS.TEXT.DESCRIPTION};
    margin-bottom: 6px;
`;

const bar = css`
    height: 6px;
    background-color: ${COLORS.DISABLED};
    border-radius: 9999px;
    overflow: hidden;
    position: relative;
`;

const getStepProgressFillStyle = (percentage: number, completed: boolean, size: SizeType) => css`
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    border-radius: 9999px;
    background-color: ${size === 'lg'
        ? COLORS.PROGRESS.BLUE
        : completed
          ? COLORS.PROGRESS.GREEN
          : COLORS.PROGRESS.BLUE};
    transform: scaleX(${percentage / 100});
    transform-origin: left;
    transition: transform 0.3s ease;
`;

export default Progress;
