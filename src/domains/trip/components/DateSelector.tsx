import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import { css } from '@emotion/react';
import { useNavigate, useParams } from 'react-router-dom';

import { getDays } from '@/domains/trip/utils';
import { ROUTES } from '@/shared/constants/route';
import { COLORS } from '@/shared/constants/style';

interface DateSelectorProps {
    selectedDate: string;
    dates: string[];
}

const ACCENT = COLORS.PRIMARY;

const DateSelector = React.memo(({ selectedDate, dates }: DateSelectorProps) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

    const { tripKey } = useParams();
    const navigate = useNavigate();

    const scrollToCenter = useCallback((targetDate: string) => {
        const container = scrollContainerRef.current;
        const button = buttonRefs.current.get(targetDate);

        if (!(container && button)) return;

        const containerWidth = container.offsetWidth;
        const buttonLeft = button.offsetLeft;
        const buttonWidth = button.offsetWidth;

        const targetScrollLeft = buttonLeft - containerWidth / 2 + buttonWidth / 2;

        container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    }, []);

    useEffect(() => {
        if (selectedDate) {
            scrollToCenter(selectedDate);
        }
    }, [selectedDate, scrollToCenter]);

    const days = useMemo(() => getDays(dates), [dates]);

    const handleDateClick = (date: string) => {
        navigate(ROUTES.PATH.TRIP.IMAGE.BY_DATE(tripKey!, date), { replace: true });
    };

    return (
        <div css={wrapper}>
            <div ref={scrollContainerRef} css={scrollArea}>
                {days.map(({ date, dayNumber }) => {
                    const isActive = selectedDate === date;
                    return (
                        <button
                            key={date}
                            ref={(element) => {
                                if (element) {
                                    buttonRefs.current.set(date, element);
                                } else {
                                    buttonRefs.current.delete(date);
                                }
                            }}
                            css={pillStyle(isActive)}
                            onClick={() => handleDateClick(date)}
                        >
                            <span css={dayLabel(isActive)}>{dayNumber}</span>
                            <span css={dateLabel(isActive)}>{date.slice(5).replace('-', '.')}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
});

const wrapper = css`
    background: #fff;
    padding: 12px 0 13px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    flex-shrink: 0;
`;

const scrollArea = css`
    display: flex;
    gap: 8px;
    padding: 0 16px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;

    &::-webkit-scrollbar {
        display: none;
    }
`;

const pillStyle = (isActive: boolean) => css`
    flex-shrink: 0;
    padding: 8px 16px;
    border-radius: 12px;
    border: ${isActive ? 'none' : '1px solid rgba(0, 0, 0, 0.08)'};
    background: ${isActive ? ACCENT : '#fff'};
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    min-width: 64px;
    line-height: 1.15;
    box-shadow: ${isActive
        ? '0 6px 14px -8px rgba(0, 113, 227, 0.5), 0 1px 0 rgba(255, 255, 255, 0.35) inset'
        : '0 1px 1px rgba(15, 23, 42, 0.03)'};
    transition:
        transform 240ms cubic-bezier(0.32, 0.72, 0, 1),
        background 180ms ease,
        color 180ms ease,
        box-shadow 220ms ease;

    &:active {
        transform: scale(0.96);
    }
`;

const dayLabel = (isActive: boolean) => css`
    font-size: 13px;
    font-weight: 700;
    color: ${isActive ? '#fff' : '#1f2937'};
    letter-spacing: -0.1px;
`;

const dateLabel = (isActive: boolean) => css`
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.4px;
    color: ${isActive ? 'rgba(255, 255, 255, 0.72)' : '#94928c'};
    font-variant-numeric: tabular-nums;
`;

export default DateSelector;
