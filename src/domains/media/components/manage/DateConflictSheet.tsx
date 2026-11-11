import { useRef } from 'react';

import { css } from '@emotion/react';
import { CalendarRange } from 'lucide-react';

import { DateConflict, DateConflictChoice } from '@/domains/media/hooks/usePhotoUpload';
import { formatMonthDay } from '@/domains/trip/tripDates';
import BottomSheet from '@/shared/components/common/BottomSheet';
import { COLORS } from '@/shared/constants/style';

interface DateConflictSheetProps {
    conflict: DateConflict | null;
    onResolve: (choice: DateConflictChoice) => void;
}

/** "3월 5일–9일", 달이 바뀌면 "3월 30일–4월 2일", 하루면 "3월 5일" */
const formatPeriod = (start: string, end: string) => {
    if (start === end) return formatMonthDay(start);
    const s = formatMonthDay(start);
    const e = formatMonthDay(end);
    return start.slice(0, 7) === end.slice(0, 7) ? `${s}–${e.replace(/^\d+월\s/, '')}` : `${s}–${e}`;
};

/**
 * 사진을 추가할 때 여행 기간 밖에 찍힌 사진이 섞여 있으면 올리기 전에 묻는다.
 * 기간을 늘리거나, 그대로 추가하거나, 취소할 수 있다. 바깥을 눌러 닫으면 취소다.
 */
const DateConflictSheet = ({ conflict, onResolve }: DateConflictSheetProps) => {
    // 닫히는 애니메이션 동안 내용이 비지 않도록 마지막 값을 들고 있는다.
    const lastRef = useRef<DateConflict | null>(null);
    if (conflict) lastRef.current = conflict;
    const shown = conflict ?? lastRef.current;
    if (!shown) return null;

    const { outsideDates, outsideCount, totalCount, current, extended } = shown;
    const dateText =
        outsideDates.length === 1
            ? formatMonthDay(outsideDates[0])
            : `${formatMonthDay(outsideDates[0])} 외 ${outsideDates.length - 1}일`;
    const photoText = totalCount === 1 ? '이 사진은' : `${totalCount}장 중 ${outsideCount}장은`;

    return (
        <BottomSheet isOpen={Boolean(conflict)} onClose={() => onResolve('cancel')}>
            <div css={body}>
                <span css={iconBadge}>
                    <CalendarRange size={22} strokeWidth={2} />
                </span>
                <h2 css={title}>여행 기간과 날짜가 달라요</h2>
                <p css={description}>
                    {photoText} <strong>{dateText}</strong>에 찍혔어요.
                    <br />
                    지금 여행 기간은 {formatPeriod(current.start, current.end)}이에요.
                </p>

                <div css={periodCompare}>
                    <div css={periodRow}>
                        <span css={periodLabel}>지금</span>
                        <span css={periodValue(false)}>{formatPeriod(current.start, current.end)}</span>
                    </div>
                    <div css={periodRow}>
                        <span css={periodLabel}>늘리면</span>
                        <span css={periodValue(true)}>{formatPeriod(extended.start, extended.end)}</span>
                    </div>
                </div>

                <button type='button' css={primaryButton} onClick={() => onResolve('extend')}>
                    기간을 늘리고 추가하기
                </button>
                <button type='button' css={secondaryButton} onClick={() => onResolve('keep')}>
                    기간은 그대로 두고 추가하기
                </button>
                <button type='button' css={textButton} onClick={() => onResolve('cancel')}>
                    취소
                </button>
            </div>
        </BottomSheet>
    );
};

const body = css`
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
`;

const iconBadge = css`
    width: 48px;
    height: 48px;
    margin-bottom: 14px;
    border-radius: 14px;
    background: ${COLORS.BACKGROUND.PRIMARY_LIGHT};
    color: ${COLORS.PRIMARY};
    display: grid;
    place-items: center;
`;

const title = css`
    margin: 0;
    font-size: 19px;
    font-weight: 700;
    letter-spacing: -0.4px;
    color: ${COLORS.TICKET_BAND};
`;

const description = css`
    margin: 8px 0 0;
    font-size: 14px;
    line-height: 1.55;
    color: rgba(15, 23, 42, 0.6);
    word-break: keep-all;

    strong {
        color: ${COLORS.TICKET_BAND};
    }
`;

const periodCompare = css`
    width: 100%;
    margin: 18px 0 20px;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-radius: 14px;
    background: rgba(15, 23, 42, 0.03);
`;

const periodRow = css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
`;

const periodLabel = css`
    color: rgba(15, 23, 42, 0.45);
    font-weight: 600;
`;

const periodValue = (highlight: boolean) => css`
    font-weight: 700;
    color: ${highlight ? COLORS.PRIMARY : COLORS.TICKET_BAND};
`;

const primaryButton = css`
    width: 100%;
    height: 52px;
    border: none;
    border-radius: 14px;
    background: ${COLORS.PRIMARY};
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
`;

const secondaryButton = css`
    width: 100%;
    height: 48px;
    margin-top: 8px;
    border: none;
    border-radius: 14px;
    background: rgba(15, 23, 42, 0.05);
    color: ${COLORS.TICKET_BAND};
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
`;

const textButton = css`
    width: 100%;
    height: 44px;
    margin-top: 4px;
    border: none;
    background: none;
    color: rgba(15, 23, 42, 0.5);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
`;

export default DateConflictSheet;
