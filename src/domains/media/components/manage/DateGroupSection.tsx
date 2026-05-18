import { css } from '@emotion/react';

import AddPhotoCell from '@/domains/media/components/manage/AddPhotoCell';
import PhotoGridCell from '@/domains/media/components/manage/PhotoGridCell';
import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { MediaFile } from '@/domains/media/types';

interface DateGroupSectionProps {
    label: string;
    photos: MediaFile[];
    selected: Set<number>;
    selectMode: boolean;
    onToggle: (photo: MediaFile) => void;
    onAdd: () => void;
}

const COLUMNS = 3;
const GRID_GAP = 6;

const formatLabel = (recordDate: string) => {
    const d = new Date(recordDate);
    if (Number.isNaN(d.getTime())) return recordDate;
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return `${month}월 ${day}일 (${weekday})`;
};

const DateGroupSection = ({ label, photos, selected, selectMode, onToggle, onAdd }: DateGroupSectionProps) => (
    <section css={sectionStyle}>
        <div css={headRowStyle}>
            <h4 css={dateLabelStyle}>{formatLabel(label)}</h4>
            <span css={countStyle}>{photos.length}장</span>
        </div>
        <div css={gridStyle}>
            {photos.map((p) => (
                <PhotoGridCell
                    key={p.mediaFileId}
                    photo={p}
                    selected={selected.has(p.mediaFileId)}
                    selectMode={selectMode}
                    onToggle={onToggle}
                />
            ))}
            {!selectMode && <AddPhotoCell onClick={onAdd} />}
        </div>
    </section>
);

const sectionStyle = css`
    margin-bottom: 14px;
    padding: 12px;
    background: ${MANAGE_TOKENS.card};
    border-radius: 12px;
    font-family: ${MANAGE_TOKENS.font};
`;

const headRowStyle = css`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 10px;
`;

const dateLabelStyle = css`
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: ${MANAGE_TOKENS.text.primary};
`;

const countStyle = css`
    font-size: 11px;
    color: ${MANAGE_TOKENS.text.muted};
`;

const gridStyle = css`
    display: grid;
    grid-template-columns: repeat(${COLUMNS}, 1fr);
    gap: ${GRID_GAP}px;
`;

export default DateGroupSection;
