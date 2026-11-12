import React, { useCallback, useEffect, useRef } from 'react';

import { css } from '@emotion/react';

import { COLORS } from '@/shared/constants/style';

export interface Pill {
    key: string;
    label: string;
    caption: string;
}

interface PillSelectorProps {
    pills: Pill[];
    activeKey: string;
    onSelect: (key: string) => void;
    ariaLabel: string;
}

const PillSelector = React.memo(({ pills, activeKey, onSelect, ariaLabel }: PillSelectorProps) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

    const scrollToCenter = useCallback((key: string) => {
        const container = scrollContainerRef.current;
        const button = buttonRefs.current.get(key);
        if (!(container && button)) return;
        const targetScrollLeft = button.offsetLeft - container.offsetWidth / 2 + button.offsetWidth / 2;
        container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    }, []);

    useEffect(() => {
        if (activeKey) scrollToCenter(activeKey);
    }, [activeKey, scrollToCenter]);

    return (
        <div css={wrapper}>
            <div ref={scrollContainerRef} css={scrollArea} role='group' aria-label={ariaLabel}>
                {pills.map(({ key, label, caption }) => {
                    const isActive = activeKey === key;
                    return (
                        <button
                            key={key}
                            type='button'
                            ref={(element) => {
                                if (element) buttonRefs.current.set(key, element);
                                else buttonRefs.current.delete(key);
                            }}
                            css={pillStyle(isActive)}
                            aria-pressed={isActive}
                            onClick={() => onSelect(key)}
                        >
                            <span css={labelText(isActive)}>{label}</span>
                            <span css={captionText(isActive)}>{caption}</span>
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
    background: ${isActive ? COLORS.PRIMARY : '#fff'};
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

const labelText = (isActive: boolean) => css`
    font-size: 13px;
    font-weight: 700;
    color: ${isActive ? '#fff' : '#1f2937'};
    letter-spacing: -0.1px;
`;

const captionText = (isActive: boolean) => css`
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.4px;
    color: ${isActive ? 'rgba(255, 255, 255, 0.72)' : '#94928c'};
    font-variant-numeric: tabular-nums;
`;

export default PillSelector;
