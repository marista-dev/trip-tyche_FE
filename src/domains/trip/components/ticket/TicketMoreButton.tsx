import { css } from '@emotion/react';

interface TicketMoreButtonProps {
    placement: 'band' | 'photo';
    onClick: () => void;
}

const TicketMoreButton = ({ placement, onClick }: TicketMoreButtonProps) => (
    <button
        aria-label='옵션 더보기'
        onClick={(event) => {
            event.stopPropagation();
            onClick();
        }}
        css={[moreButtonStyle, placement === 'photo' && onPhotoStyle]}
    >
        <svg
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2.2'
            strokeLinecap='round'
            strokeLinejoin='round'
        >
            <circle cx='5' cy='12' r='1.5' />
            <circle cx='12' cy='12' r='1.5' />
            <circle cx='19' cy='12' r='1.5' />
        </svg>
    </button>
);

const moreButtonStyle = css`
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: rgba(255, 255, 255, 0.75);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    -webkit-tap-highlight-color: transparent;

    &:hover {
        background: rgba(255, 255, 255, 0.18);
    }
`;

const onPhotoStyle = css`
    width: 28px;
    height: 28px;
    background: rgba(15, 23, 42, 0.35);
    color: #fff;
    backdrop-filter: blur(8px);

    &:hover {
        background: rgba(15, 23, 42, 0.5);
    }
`;

export default TicketMoreButton;
