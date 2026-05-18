import { css } from '@emotion/react';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';

interface StickyApplyCTAProps {
    label: string;
    disabled?: boolean;
    isLoading?: boolean;
    onClick: () => void;
}

const StickyApplyCTA = ({ label, disabled, isLoading, onClick }: StickyApplyCTAProps) => (
    <div css={wrapStyle}>
        <button
            type='button'
            css={buttonStyle(!disabled && !isLoading)}
            onClick={onClick}
            disabled={disabled || isLoading}
        >
            {isLoading ? '적용 중...' : label}
        </button>
    </div>
);

const wrapStyle = css`
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    padding: 12px 16px 24px;
    background: linear-gradient(180deg, rgba(250, 250, 250, 0) 0%, rgba(250, 250, 250, 1) 30%);
    pointer-events: none;
    & > button {
        pointer-events: auto;
    }
`;

const buttonStyle = (active: boolean) => css`
    width: 100%;
    padding: 14px 0;
    background: ${active ? MANAGE_TOKENS.accent : 'rgba(0,0,0,0.15)'};
    color: #fff;
    border: none;
    border-radius: 14px;
    font-family: ${MANAGE_TOKENS.font};
    font-size: 15px;
    font-weight: 700;
    cursor: ${active ? 'pointer' : 'not-allowed'};
    box-shadow: ${active ? '0 8px 22px rgba(0,113,227,0.3)' : 'none'};
    transition: background 200ms ease;
    -webkit-tap-highlight-color: transparent;
    &:active {
        opacity: ${active ? 0.9 : 1};
    }
`;

export default StickyApplyCTA;
