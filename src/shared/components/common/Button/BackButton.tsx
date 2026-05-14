import { css } from '@emotion/react';
import { ChevronLeft } from 'lucide-react';

// Apple Glass — 반투명 다크 글래스 + 블러 + 미세 내부광 + 압축 피드백
const BackButton = ({ onClick }: { onClick: () => void }) => {
    return (
        <button css={buttonStyle} onClick={onClick} aria-label='뒤로가기'>
            <ChevronLeft color='#fff' size={20} strokeWidth={2.4} />
        </button>
    );
};

const buttonStyle = css`
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 30;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(10, 10, 12, 0.55);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.14);
    display: grid;
    place-items: center;
    cursor: pointer;
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.18) inset,
        0 10px 24px -12px rgba(0, 0, 0, 0.55);
    transition: transform 360ms cubic-bezier(0.32, 0.72, 0, 1), background 240ms ease;

    &:active {
        transform: scale(0.94);
        background: rgba(10, 10, 12, 0.7);
    }
`;

export default BackButton;
