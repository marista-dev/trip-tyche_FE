import { useState } from 'react';

import { css, keyframes } from '@emotion/react';
import { Calendar, Check, MapPin, MoreHorizontal, Trash2 } from 'lucide-react';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';

interface SelectionActionFABProps {
    selectedCount: number;
    onEditLocation: () => void;
    onEditDate: () => void;
    onDelete: () => void;
}

const SelectionActionFAB = ({ selectedCount, onEditLocation, onEditDate, onDelete }: SelectionActionFABProps) => {
    const [open, setOpen] = useState(false);

    const close = () => setOpen(false);

    const runAndClose = (fn: () => void) => () => {
        close();
        fn();
    };

    return (
        <>
            {open && <div css={backdropStyle} onClick={close} aria-hidden='true' />}

            {open && (
                <div css={menuStyle} role='menu'>
                    <button type='button' css={menuItemStyle} onClick={runAndClose(onEditLocation)}>
                        <MapPin size={16} strokeWidth={2} />
                        위치 수정
                    </button>
                    <button type='button' css={menuItemStyle} onClick={runAndClose(onEditDate)}>
                        <Calendar size={16} strokeWidth={2} />
                        날짜 수정
                    </button>
                    <div css={dividerStyle} />
                    <button type='button' css={menuItemDestructiveStyle} onClick={runAndClose(onDelete)}>
                        <Trash2 size={16} strokeWidth={2} />
                        삭제
                    </button>
                </div>
            )}

            <button
                type='button'
                css={fabStyle(open)}
                onClick={() => setOpen((v) => !v)}
                aria-label='선택 작업'
                aria-expanded={open}
            >
                <MoreHorizontal size={28} strokeWidth={2.4} />
            </button>

            <div css={countChipStyle} aria-live='polite'>
                <Check size={14} strokeWidth={2.4} color='#fff' />
                {selectedCount}장 선택
            </div>
        </>
    );
};

const menuIn = keyframes`
    0%   { opacity: 0; transform: scale(0.85) translateY(8px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
`;

const backdropStyle = css`
    position: fixed;
    inset: 0;
    z-index: 70;
`;

const menuStyle = css`
    position: fixed;
    left: 20px;
    bottom: 100px;
    z-index: 80;
    min-width: 200px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 14px;
    box-shadow:
        0 12px 30px rgba(0, 0, 0, 0.18),
        0 0 0 1px rgba(0, 0, 0, 0.05);
    transform-origin: bottom left;
    animation: ${menuIn} 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
    font-family: ${MANAGE_TOKENS.font};
`;

const menuItemBase = css`
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    &:active {
        background: rgba(0, 0, 0, 0.05);
    }
`;

const menuItemStyle = css`
    ${menuItemBase};
    color: ${MANAGE_TOKENS.text.primary};
`;

const menuItemDestructiveStyle = css`
    ${menuItemBase};
    color: ${MANAGE_TOKENS.destructive};
`;

const dividerStyle = css`
    height: 1px;
    margin: 4px 8px;
    background: rgba(0, 0, 0, 0.08);
`;

const fabStyle = (open: boolean) => css`
    position: fixed;
    left: 20px;
    bottom: 24px;
    z-index: 75;
    width: 64px;
    height: 64px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.55);
    box-shadow:
        0 10px 28px rgba(0, 0, 0, 0.18),
        0 0 0 1px rgba(0, 0, 0, 0.05);
    color: ${MANAGE_TOKENS.text.primary};
    cursor: pointer;
    transform: ${open ? 'rotate(90deg)' : 'rotate(0)'};
    transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
`;

const countChipStyle = css`
    position: fixed;
    left: 50%;
    bottom: 36px;
    transform: translateX(-50%);
    z-index: 75;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 22px;
    border-radius: 999px;
    background: rgba(17, 17, 17, 0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    color: #fff;
    font-family: ${MANAGE_TOKENS.font};
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.3px;
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.26);
    pointer-events: none;
    white-space: nowrap;
`;

export default SelectionActionFAB;
