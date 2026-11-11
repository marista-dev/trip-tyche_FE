import { useRef } from 'react';

import { css } from '@emotion/react';

import { DateConflict, DateConflictChoice } from '@/domains/media/hooks/usePhotoUpload';
import { formatDateSummary, formatPeriod } from '@/domains/trip/tripDates';
import SheetDialog from '@/shared/components/common/BottomSheet/SheetDialog';
import { COLORS } from '@/shared/constants/style';

interface DateConflictSheetProps {
    conflict: DateConflict | null;
    onResolve: (choice: DateConflictChoice) => void;
}

/** 기간 밖에 찍힌 사진을 올리기 전에 묻는다. 바깥을 눌러 닫으면 취소. */
const DateConflictSheet = ({ conflict, onResolve }: DateConflictSheetProps) => {
    // 닫히는 애니메이션 동안 마지막 내용을 유지한다.
    const lastRef = useRef<DateConflict | null>(null);
    if (conflict) lastRef.current = conflict;
    const shown = conflict ?? lastRef.current;
    if (!shown) return null;

    const { outsideDates, outsideCount, totalCount, current, extended } = shown;
    const dateText = formatDateSummary(outsideDates);
    const photoText = totalCount === 1 ? '이 사진은' : `${totalCount}장 중 ${outsideCount}장은`;

    return (
        <SheetDialog
            isOpen={Boolean(conflict)}
            onClose={() => onResolve('cancel')}
            title='여행 기간과 날짜가 달라요'
            description={
                <>
                    {photoText} <strong>{dateText}</strong>에 찍혔어요.
                </>
            }
            primary={{ label: '기간을 늘리고 추가하기', onClick: () => onResolve('extend') }}
            secondary={{ label: '기간은 그대로 두고 추가하기', onClick: () => onResolve('keep') }}
            tertiary={{ label: '취소', onClick: () => onResolve('cancel') }}
        >
            <dl css={periodCompare}>
                <div css={periodRow}>
                    <dt>지금</dt>
                    <dd>{formatPeriod(current.start, current.end)}</dd>
                </div>
                <div css={[periodRow, periodRowHighlight]}>
                    <dt>늘리면</dt>
                    <dd>{formatPeriod(extended.start, extended.end)}</dd>
                </div>
            </dl>
        </SheetDialog>
    );
};

const periodCompare = css`
    margin: 0;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-radius: 14px;
    background: ${COLORS.SURFACE_SUBTLE};
`;

const periodRow = css`
    display: flex;
    justify-content: space-between;
    font-size: 13px;

    dt {
        color: ${COLORS.TEXT.DESCRIPTION_LIGHT};
        font-weight: 600;
    }

    dd {
        margin: 0;
        font-weight: 700;
        color: ${COLORS.TEXT.BLACK};
    }
`;

const periodRowHighlight = css`
    dd {
        color: ${COLORS.PRIMARY};
    }
`;

export default DateConflictSheet;
