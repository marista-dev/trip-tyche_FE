import { css } from '@emotion/react';
import { CalendarDays, ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';

import { COLORS } from '@/shared/constants/style';

interface MapControlButtonsProps {
    isVisible: boolean;
    isComplete: boolean;
    isPaused: boolean;
    currentPinPointIndex: number;
    totalPinPoints: number;
    currentDate?: string;
    handler: {
        handleDateViewClick: () => void;
        handleRestart: () => void;
        handlePauseToggle: () => void;
        handlePrevPin: () => void;
        handleNextPin: () => void;
    };
}

const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
};

const MapControlButtons = ({
    isVisible,
    isComplete,
    isPaused,
    currentPinPointIndex,
    totalPinPoints,
    currentDate,
    handler,
}: MapControlButtonsProps) => {
    if (!isVisible) return null;

    const formattedDate = formatDate(currentDate);

    // 우측 액션 버튼 상태 결정
    let ActionIcon = Pause;
    let actionLabel = '일시정지';
    let actionHandler = handler.handlePauseToggle;
    if (isComplete) {
        ActionIcon = RotateCcw;
        actionLabel = '다시 재생';
        actionHandler = handler.handleRestart;
    } else if (isPaused) {
        ActionIcon = Play;
        actionLabel = '재생';
        actionHandler = handler.handlePauseToggle;
    }

    const showNav = isPaused && !isComplete;
    const isFirst = currentPinPointIndex <= 0;
    const isLast = currentPinPointIndex >= totalPinPoints - 1;

    return (
        <div css={barStyle}>
            {/* 날짜별 보기 */}
            <button css={iconBtnStyle} onClick={handler.handleDateViewClick} aria-label='날짜별 사진 보기'>
                <CalendarDays size={18} />
            </button>

            {/* 일시정지 중에만 — 이전 핀 */}
            {showNav && (
                <button css={navBtnStyle} onClick={handler.handlePrevPin} disabled={isFirst} aria-label='이전 핀'>
                    <ChevronLeft size={16} />
                </button>
            )}

            {/* 중앙 진행 정보 */}
            <div css={infoStyle}>
                <span css={progressStyle}>
                    {currentPinPointIndex + 1}
                    <span css={progressTotalStyle}> / {totalPinPoints}</span>
                </span>
                {formattedDate && <span css={dateStyle}>{formattedDate}</span>}
            </div>

            {/* 일시정지 중에만 — 다음 핀 */}
            {showNav && (
                <button css={navBtnStyle} onClick={handler.handleNextPin} disabled={isLast} aria-label='다음 핀'>
                    <ChevronRight size={16} />
                </button>
            )}

            {/* 일시정지 / 재생 / 다시 재생 — 상태 기반 */}
            <button css={actionBtnStyle} onClick={actionHandler} aria-label={actionLabel}>
                <ActionIcon size={15} />
                {actionLabel}
            </button>
        </div>
    );
};

const barStyle = css`
    position: absolute;
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    left: 16px;
    right: 16px;
    background: rgba(10, 10, 20, 0.8);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 90;
`;

const iconBtnStyle = css`
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
    transition: background 0.15s;
    -webkit-tap-highlight-color: transparent;

    &:active {
        background: rgba(255, 255, 255, 0.18);
    }
`;

const navBtnStyle = css`
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
    transition:
        background 0.15s,
        opacity 0.15s;
    -webkit-tap-highlight-color: transparent;

    &:active:not(:disabled) {
        background: rgba(255, 255, 255, 0.16);
    }

    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
`;

const infoStyle = css`
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
`;

const progressStyle = css`
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    line-height: 1;
`;

const progressTotalStyle = css`
    font-weight: 400;
    color: rgba(255, 255, 255, 0.5);
`;

const dateStyle = css`
    font-size: 11px;
    color: rgba(255, 255, 255, 0.45);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
`;

const actionBtnStyle = css`
    height: 40px;
    min-width: 108px;
    border-radius: 12px;
    background: ${COLORS.PRIMARY};
    border: none;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 14px;
    flex-shrink: 0;
    cursor: pointer;
    transition: opacity 0.15s;
    -webkit-tap-highlight-color: transparent;

    &:active {
        opacity: 0.82;
    }
`;

export default MapControlButtons;
