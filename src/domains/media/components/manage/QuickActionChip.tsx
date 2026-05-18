import { css } from '@emotion/react';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';

interface QuickActionChipProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
}

const QuickActionChip = ({ icon, label, onClick }: QuickActionChipProps) => (
    <button type='button' css={chipStyle} onClick={onClick}>
        {icon}
        {label}
    </button>
);

const chipStyle = css`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 8px 10px;
    background: #f5f5f5;
    border: 1px solid ${MANAGE_TOKENS.border};
    border-radius: 8px;
    color: ${MANAGE_TOKENS.text.primary};
    font-family: ${MANAGE_TOKENS.font};
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 120ms ease;
    &:active {
        background: #ececec;
    }
`;

export default QuickActionChip;
