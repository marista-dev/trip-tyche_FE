import { useEffect, useState } from 'react';

import { css } from '@emotion/react';
import { ChevronRight, Globe, Image as ImageIcon, Plane, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { UserStats } from '@/domains/user/utils/stats';
import BottomSheet from '@/shared/components/common/BottomSheet/BottomSheet';
import { ROUTES } from '@/shared/constants/route';
import { COLORS } from '@/shared/constants/style';

export type StatView = 'trips' | 'photos' | 'countries';

interface StatBottomSheetProps {
    view: StatView | null;
    stats: UserStats;
    onClose: () => void;
}

interface StatRow {
    label: string;
    sub: string;
    value: string;
    warn?: boolean;
}

const TRIP_ROW_LIMIT = 6;
const COUNTRY_ROW_LIMIT = 8;

const formatDate = (value: string): string => (value ?? '').split('T')[0].replace(/-/g, '.');

/**
 * 설정 페이지 통계 상세 바텀시트 (여행 / 사진 / 국가).
 * 공용 BottomSheet(핸들바·딤·드래그 닫기 포함)를 재사용하고, 내부에 헤더/행/푸터 CTA만 구성한다.
 */
const StatBottomSheet = ({ view, stats, onClose }: StatBottomSheetProps) => {
    // 닫힘 애니메이션 동안 직전 view의 내용이 유지되도록 마지막 non-null view를 보관
    const [renderView, setRenderView] = useState<StatView | null>(view);
    useEffect(() => {
        if (view) setRenderView(view);
    }, [view]);

    const navigate = useNavigate();

    const go = (path: string) => {
        onClose();
        navigate(path);
    };

    const content = renderView ? buildContent(renderView, stats) : null;

    return (
        <BottomSheet isOpen={view !== null} onClose={onClose} maxHeight='76vh'>
            {content && (
                <div css={wrapper}>
                    <div css={header}>
                        <div css={iconBox}>{content.icon}</div>
                        <div css={headerText}>
                            <p css={headerTitle}>{content.title}</p>
                            <p css={headerCount}>
                                {content.count}
                                <span css={headerUnit}>{content.unit}</span>
                            </p>
                        </div>
                        <button css={closeButton} onClick={onClose} aria-label='닫기'>
                            <X size={14} color='#666' strokeWidth={2.6} />
                        </button>
                    </div>

                    <div css={rowList}>
                        {content.rows.length === 0 ? (
                            <p css={emptyText}>아직 표시할 내용이 없어요</p>
                        ) : (
                            content.rows.map((row, index) => (
                                <div css={row.warn ? rowItemWarn : rowItem} key={`${row.label}-${index}`}>
                                    <div css={rowMain}>
                                        <p css={rowLabel}>{row.label}</p>
                                        <p css={row.warn ? rowSubWarn : rowSub}>{row.sub}</p>
                                    </div>
                                    <span css={row.warn ? rowValueWarn : rowValue}>{row.value}</span>
                                </div>
                            ))
                        )}
                    </div>

                    <button css={ctaButton} onClick={() => go(content.ctaPath)}>
                        {content.ctaLabel}
                        <ChevronRight size={14} strokeWidth={2.4} />
                    </button>
                </div>
            )}
        </BottomSheet>
    );
};

export default StatBottomSheet;

interface SheetContent {
    icon: React.ReactNode;
    title: string;
    count: string;
    unit: string;
    rows: StatRow[];
    ctaLabel: string;
    ctaPath: string;
}

const buildContent = (view: StatView, stats: UserStats): SheetContent => {
    if (view === 'trips') {
        const shown = Math.min(stats.byTrip.length, TRIP_ROW_LIMIT);
        const remaining = Math.max(0, stats.tripsCount - shown);
        return {
            icon: <Plane size={22} color={COLORS.PRIMARY} strokeWidth={2} />,
            title: '내 여행',
            count: String(stats.tripsCount),
            unit: '번의 여행',
            rows: stats.byTrip.slice(0, TRIP_ROW_LIMIT).map((trip) => ({
                label: trip.tripTitle,
                sub: `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}`,
                value: `${trip.photoCount}장`,
            })),
            ctaLabel: remaining > 0 ? `+${remaining}개의 여행 더보기` : '여행 전체 보기',
            ctaPath: ROUTES.PATH.TICKETS,
        };
    }

    if (view === 'photos') {
        const rows: StatRow[] = [
            { label: '위치 정보 있음', sub: '지도에 표시 가능', value: `${stats.locatedPhotos}장` },
            {
                label: '위치 정보 없음',
                sub: '처리 필요',
                value: `${stats.unlocatedPhotos}장`,
                warn: stats.unlocatedPhotos > 0,
            },
        ];
        if (stats.mostPhotographedDay) {
            const { date, count, label } = stats.mostPhotographedDay;
            rows.push({
                label: '가장 많이 찍은 날',
                sub: `${date.slice(5).replace(/-/g, '.')}${label ? ` ${label}` : ''}`,
                value: `${count}장`,
            });
        }
        return {
            icon: <ImageIcon size={22} color={COLORS.PRIMARY} strokeWidth={2} />,
            title: '내 사진',
            count: String(stats.totalPhotos),
            unit: '장의 사진',
            rows,
            ctaLabel: '사진 관리로 이동',
            ctaPath: ROUTES.PATH.TICKETS,
        };
    }

    return {
        icon: <Globe size={22} color={COLORS.PRIMARY} strokeWidth={2} />,
        title: '방문한 국가',
        count: String(stats.countriesCount),
        unit: '개국',
        rows: stats.byCountry.slice(0, COUNTRY_ROW_LIMIT).map((country) => ({
            label: `${country.emoji} ${country.name}`.trim(),
            sub: `${country.visits}번 방문`,
            value: `${country.photoCount}장`,
        })),
        ctaLabel: '지구본에서 보기',
        ctaPath: ROUTES.PATH.HOME,
    };
};

/* ════════════ styles ════════════ */
const wrapper = css`
    font-family:
        'Outfit',
        -apple-system,
        'SF Pro Text',
        sans-serif;
`;

const header = css`
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 0 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
`;

const iconBox = css`
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: ${COLORS.PRIMARY}12;
    display: grid;
    place-items: center;
    flex-shrink: 0;
`;

const headerText = css`
    flex: 1;
    min-width: 0;
`;

const headerTitle = css`
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: #888;
`;

const headerCount = css`
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: #111;
    letter-spacing: -0.4px;
`;

const headerUnit = css`
    margin-left: 4px;
    font-size: 13px;
    font-weight: 600;
    color: #888;
`;

const closeButton = css`
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.05);
    display: grid;
    place-items: center;
    cursor: pointer;
    flex-shrink: 0;
`;

const rowList = css`
    padding: 6px 0;
    max-height: 42vh;
    overflow-y: auto;
`;

const rowItem = css`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 4px;
    border-radius: 12px;
`;

const rowItemWarn = css`
    ${rowItem};
`;

const rowMain = css`
    flex: 1;
    min-width: 0;
`;

const rowLabel = css`
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #111;
    letter-spacing: -0.2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const rowSub = css`
    margin: 2px 0 0;
    font-size: 11px;
    color: #888;
`;

const rowSubWarn = css`
    margin: 2px 0 0;
    font-size: 11px;
    font-weight: 600;
    color: #d97706;
`;

const rowValue = css`
    font-size: 13px;
    font-weight: 700;
    color: #555;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
`;

const rowValueWarn = css`
    ${rowValue};
    color: #d97706;
`;

const emptyText = css`
    margin: 0;
    padding: 24px 0;
    text-align: center;
    font-size: 13px;
    color: #aaa;
`;

const ctaButton = css`
    margin-top: 8px;
    width: 100%;
    padding: 13px 0;
    border: none;
    border-radius: 12px;
    background: ${COLORS.PRIMARY}10;
    color: ${COLORS.PRIMARY};
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
`;
