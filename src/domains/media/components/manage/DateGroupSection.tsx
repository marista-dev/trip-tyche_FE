import { css } from '@emotion/react';

import AddPhotoCell from '@/domains/media/components/manage/AddPhotoCell';
import PendingPhotoCell from '@/domains/media/components/manage/PendingPhotoCell';
import PhotoGridCell from '@/domains/media/components/manage/PhotoGridCell';
import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { MediaFile } from '@/domains/media/types';

export interface PendingPhoto {
    id: string;
    previewUrl: string;
}

interface DateGroupSectionProps {
    label: string;
    photos: MediaFile[];
    pending?: PendingPhoto[];
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

const DateGroupSection = ({
    label,
    photos,
    pending = [],
    selected,
    selectMode,
    onToggle,
    onAdd,
}: DateGroupSectionProps) => {
    const total = photos.length + pending.length;
    return (
        <section css={sectionStyle}>
            <div css={headRowStyle}>
                <h4 css={dateLabelStyle}>{formatLabel(label)}</h4>
                <span css={countStyle}>{total}장</span>
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
                {pending.map((p) => (
                    <PendingPhotoCell key={p.id} previewUrl={p.previewUrl} />
                ))}
                {!selectMode && <AddPhotoCell onClick={onAdd} />}
            </div>
        </section>
    );
};

// 사진은 다크 배경 위에서 가장 또렷하게 보임 — 그리드 카드를 다크로 전환
const sectionStyle = css`
    margin-bottom: 14px;
    padding: 12px;
    background: #0f172a;
    border-radius: 12px;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.18);
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
    color: #ffffff;
    letter-spacing: -0.1px;
`;

const countStyle = css`
    font-size: 11px;
    color: rgba(255, 255, 255, 0.55);
`;

const gridStyle = css`
    display: grid;
    grid-template-columns: repeat(${COLUMNS}, 1fr);
    gap: ${GRID_GAP}px;
`;

export default DateGroupSection;
