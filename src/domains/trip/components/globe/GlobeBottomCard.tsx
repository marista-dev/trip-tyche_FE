/* 지구본 하단 카드: 빈 상태 CTA · 티켓 목록 진입 버튼. 지구본을 놓고 잠시 뒤 아래에서 올라온다 */
import { css } from '@emotion/react';

import { COLORS } from '@/shared/constants/style';

const { ACCENT } = COLORS;

interface EmptyTripCtaProps {
    visible: boolean;
    onCreate: () => void;
}

export const EmptyTripCta = ({ visible, onCreate }: EmptyTripCtaProps) => (
    <div css={[emptyCard, slideUp(visible)]}>
        <div css={emptyCardHead}>
            <div css={emptyIconBox}>
                <svg
                    width='22'
                    height='22'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke={ACCENT}
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                >
                    <path d='M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.2.6-.6.5-1.1z' />
                </svg>
            </div>
            <div>
                <p css={emptyCardTitle}>첫 여행을 기록해볼까요?</p>
                <p css={emptyCardSub}>티켓 하나만 있으면 지구본이 채워져요</p>
            </div>
        </div>
        <button css={emptyCtaBtn} onClick={onCreate}>
            <svg
                width='14'
                height='14'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2.5'
                strokeLinecap='round'
            >
                <path d='M12 5v14M5 12h14' />
            </svg>
            첫 티켓 만들기
        </button>
    </div>
);

interface TicketEntryButtonProps {
    visible: boolean;
    ticketCount: number;
    onClick: () => void;
}

export const TicketEntryButton = ({ visible, ticketCount, onClick }: TicketEntryButtonProps) => (
    <button css={[ticketEntry, slideUp(visible)]} onClick={onClick}>
        <div css={ticketEntryIcon}>
            <svg
                width='18'
                height='18'
                viewBox='0 0 24 24'
                fill='none'
                stroke={ACCENT}
                strokeWidth='2.2'
                strokeLinecap='round'
                strokeLinejoin='round'
            >
                <path d='M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z' />
                <path d='M13 5v14' />
            </svg>
        </div>
        <div css={ticketEntryText}>
            <span css={ticketEntryTitle}>내 티켓 {ticketCount}장</span>
            <span css={ticketEntrySub}>리스트로 보기 · 새 티켓 추가</span>
        </div>
        <svg
            width='18'
            height='18'
            viewBox='0 0 24 24'
            fill='none'
            stroke='#cbd5e1'
            strokeWidth='2'
            strokeLinecap='round'
        >
            <polyline points='9 18 15 12 9 6' />
        </svg>
    </button>
);

/** 숨김 상태에서는 화면 아래로 내려가 있다 */
const slideUp = (visible: boolean) => css`
    transform: ${visible ? 'translateY(0)' : 'translateY(calc(100% + 40px))'};
    opacity: ${visible ? 1 : 0};
    transition:
        transform 600ms cubic-bezier(0.22, 1, 0.36, 1),
        opacity 400ms ease;
`;

const pressable = css`
    -webkit-tap-highlight-color: transparent;
    &:active {
        opacity: 0.85;
        transform: scale(0.98);
    }
`;

/* empty CTA card */
const emptyCard = css`
    position: absolute;
    bottom: 36px;
    left: 16px;
    right: 16px;
    z-index: 30;
    background: #fff;
    border-radius: 20px;
    padding: 18px 20px;
    box-shadow:
        0 12px 48px rgba(37, 99, 235, 0.12),
        0 4px 16px rgba(0, 0, 0, 0.04);
    border: 1px solid rgba(0, 0, 0, 0.04);
`;

const emptyCardHead = css`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
`;

const emptyIconBox = css`
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: ${ACCENT}18;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
`;

const emptyCardTitle = css`
    font-size: 15px;
    font-weight: 700;
    color: #111827;
    letter-spacing: -0.3px;
    margin-bottom: 3px;
`;

const emptyCardSub = css`
    font-size: 12px;
    color: #6b7280;
    line-height: 1.5;
`;

const emptyCtaBtn = css`
    width: 100%;
    padding: 13px 0;
    border-radius: 12px;
    background: ${ACCENT};
    color: #fff;
    border: none;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.2px;
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-shadow: 0 6px 20px ${ACCENT}50;
    ${pressable}
`;

/* populated bottom entry */
const ticketEntry = css`
    position: absolute;
    bottom: 28px;
    left: 16px;
    right: 16px;
    z-index: 30;
    background: #fff;
    border-radius: 16px;
    padding: 14px 18px;
    box-shadow:
        0 8px 32px rgba(15, 23, 42, 0.12),
        0 2px 8px rgba(0, 0, 0, 0.04);
    border: 1px solid rgba(0, 0, 0, 0.04);
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    ${pressable}
`;

const ticketEntryIcon = css`
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: ${ACCENT}15;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
`;

const ticketEntryText = css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const ticketEntryTitle = css`
    font-size: 14px;
    font-weight: 700;
    color: #111827;
    letter-spacing: -0.2px;
`;

const ticketEntrySub = css`
    font-size: 11px;
    color: #94a3b8;
`;
