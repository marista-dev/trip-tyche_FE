import { css } from '@emotion/react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { COLORS } from '@/shared/constants/style';

interface HeaderProps {
    title: string;
    isBackButton?: boolean;
    children?: React.ReactNode;
    onBack?: () => void;
}

const Header = ({ title, isBackButton, children, onBack }: HeaderProps) => {
    const navigate = useNavigate();

    const navigateBeforePage = () => (onBack ? onBack() : navigate(-1));

    return (
        <div css={headerStyle}>
            <div css={defaultStyle}>
                {isBackButton && (
                    <button css={backButtonStyle} onClick={navigateBeforePage} aria-label='뒤로 가기'>
                        <ChevronLeft size={20} strokeWidth={1.5} aria-hidden='true' />
                    </button>
                )}
                <h1 css={titleStyle}>{title}</h1>
            </div>
            {children}
        </div>
    );
};

const headerStyle = css`
    padding: 0 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 48px;
    background: #ffffff;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
    z-index: 30;
    user-select: none;
    position: sticky;
    top: 0;
`;

const defaultStyle = css`
    display: flex;
    align-items: center;
    gap: 4px;
`;

const titleStyle = css`
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.4px;
    color: #0f172a;
`;

const backButtonStyle = css`
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    margin-left: -8px;
    border: none;
    background: none;
    cursor: pointer;
    color: ${COLORS.PRIMARY};
    border-radius: 8px;
    transition: opacity 0.15s;
    -webkit-tap-highlight-color: transparent;
    &:active {
        opacity: 0.6;
    }
`;

export default Header;
