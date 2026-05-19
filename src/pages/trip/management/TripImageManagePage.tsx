import { useMemo, useState } from 'react';

import { css } from '@emotion/react';
import { ImageOff } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import DateGroupSection from '@/domains/media/components/manage/DateGroupSection';
import IssueCard from '@/domains/media/components/manage/IssueCard';
import ManageHeader from '@/domains/media/components/manage/ManageHeader';
import SelectionActionFAB from '@/domains/media/components/manage/SelectionActionFAB';
import { managePageContainerStyle } from '@/domains/media/components/manage/styles';
import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { useMediaDelete } from '@/domains/media/hooks/mutations';
import { useTripPhotos } from '@/domains/media/hooks/queries';
import { usePhotoSelection } from '@/domains/media/hooks/usePhotoSelection';
import { usePhotoUpload } from '@/domains/media/hooks/usePhotoUpload';
import { useEstimateStore } from '@/domains/media/stores/useEstimateStore';
import { MediaFile } from '@/domains/media/types';
import {
    filterValidMediaFile,
    filterWithoutDateMediaFile,
    filterWithoutLocationMediaFile,
    getImageGroupByDate,
} from '@/domains/media/utils';
import { useTripInfo } from '@/domains/trip/hooks/queries';
import InlineDatePickSheet from '@/pages/trip/management/InlineDatePickSheet';
import EmptyItem from '@/shared/components/common/EmptyItem';
import ConfirmModal from '@/shared/components/common/Modal/ConfirmModal';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import { ROUTES } from '@/shared/constants/route';
import { useToastStore } from '@/shared/stores/useToastStore';

const formatDateRange = (start?: string, end?: string): string => {
    if (!start || !end) return '';
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
    const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1);
    const fmt = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;
    if (s.toDateString() === e.toDateString()) return `${fmt(s)} · 1일`;
    return `${fmt(s)}–${fmt(e).replace(/^\d+월\s/, '')} · ${days}일`;
};

const TripImageManagePage = () => {
    const { tripKey = '' } = useParams<{ tripKey: string }>();
    const navigate = useNavigate();
    const { showToast } = useToastStore();
    const setEstimateTargets = useEstimateStore((s) => s.setTargets);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showDateSheet, setShowDateSheet] = useState(false);

    // 데이터 + 뮤테이션
    const { photos: allImages, isLoading: isImagesLoading } = useTripPhotos(tripKey);
    const { data: tripInfoResult } = useTripInfo(tripKey);
    const { mutate: deleteMutate, isPending: isDeleting } = useMediaDelete();

    // 선택 상태 + 업로드 흐름 (각 책임을 hook으로 격리)
    const { selected, selectMode, size: selectedCount, toggle: togglePhoto, clear: clearSelection } = usePhotoSelection();
    const { fileInputRef, openFilePicker, handleFileSelected, isUploading, uploadingText, pendingByDate } =
        usePhotoUpload(tripKey);

    const tripInfo = tripInfoResult?.success ? tripInfoResult.data : undefined;

    // 파생 데이터 — 카테고리별 분류 + 날짜 그룹 + pending 머지
    const noLocImages = useMemo(() => filterWithoutLocationMediaFile(allImages) as MediaFile[], [allImages]);
    const noDateImages = useMemo(() => filterWithoutDateMediaFile(allImages) as MediaFile[], [allImages]);
    const validImages = useMemo(() => filterValidMediaFile(allImages) as MediaFile[], [allImages]);
    const baseGroups = useMemo(() => getImageGroupByDate(validImages), [validImages]);

    // pending 미리보기를 날짜별로 baseGroups에 머지. 기존 그룹이 없으면 새 그룹 생성.
    const renderGroups = useMemo(() => {
        const merged = baseGroups.map((g) => ({ ...g, pending: pendingByDate[g.recordDate] ?? [] }));
        const existingDates = new Set(baseGroups.map((g) => g.recordDate));
        Object.entries(pendingByDate).forEach(([date, pending]) => {
            if (date === 'unknown') return;
            if (!existingDates.has(date)) {
                merged.push({ recordDate: date, images: [], pending });
            }
        });
        return merged.sort((a, b) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime());
    }, [baseGroups, pendingByDate]);

    const selectedList = useMemo(
        () => allImages.filter((img) => selected.has(img.mediaFileId)),
        [allImages, selected],
    );

    const handleDelete = () => {
        if (selectedList.length === 0) return;
        deleteMutate(
            { tripKey, images: selectedList },
            {
                onSuccess: (result) => {
                    showToast(result.success ? result.data : result.error);
                    setShowDeleteConfirm(false);
                    clearSelection();
                },
            },
        );
    };

    const goNoLocation = () => navigate(ROUTES.PATH.TRIP.EDIT.NO_LOCATION(tripKey));
    const goNoDate = () => navigate(ROUTES.PATH.TRIP.EDIT.NO_DATE(tripKey));

    const handleEditLocation = () => {
        if (selectedList.length === 0) return;
        setEstimateTargets({ mode: 'map-pick', tripKey, targets: selectedList });
        navigate(ROUTES.PATH.TRIP.EDIT.MAP_PICK(tripKey));
    };

    const handleEditDate = () => {
        if (selectedList.length === 0) return;
        setShowDateSheet(true);
    };

    const totalCount = allImages.length;
    const hasIssues = noLocImages.length > 0 || noDateImages.length > 0;
    const dateRange = formatDateRange(tripInfo?.startDate, tripInfo?.endDate);

    return (
        <div css={managePageContainerStyle}>
            {(isImagesLoading || isDeleting) && <Indicator text={isDeleting ? '사진 삭제 중...' : undefined} />}
            {isUploading && (
                <div css={uploadChipStyle} role='status' aria-live='polite'>
                    {uploadingText}
                </div>
            )}

            <input
                ref={fileInputRef}
                type='file'
                accept='image/*,image/heic,image/heif'
                multiple
                hidden
                onChange={handleFileSelected}
            />

            <ManageHeader
                title='사진 관리'
                selectedCount={selectedCount}
                onBack={() => navigate(ROUTES.PATH.TICKETS)}
                onCancel={clearSelection}
                cancelLabel='완료'
            />

            <main css={bodyStyle}>
                {!selectMode && tripInfo && (
                    <section css={tripSummaryStyle}>
                        <div css={summaryRowStyle}>
                            <h2 css={summaryTitleStyle}>{tripInfo.tripTitle}</h2>
                            <span css={summaryCountStyle}>총 {totalCount}장</span>
                        </div>
                        {dateRange && <p css={summarySubStyle}>{dateRange}</p>}
                    </section>
                )}

                {!selectMode && hasIssues && (
                    <section css={issueSectionStyle}>
                        <h3 css={sectionLabelStyle}>처리 필요</h3>
                        {noLocImages.length > 0 && (
                            <IssueCard
                                tone='red'
                                title='위치 정보 없음'
                                sub='지도에 표시되지 않아요'
                                count={noLocImages.length}
                                onResolve={goNoLocation}
                            />
                        )}
                        {noDateImages.length > 0 && (
                            <IssueCard
                                tone='amber'
                                title='날짜 정보 없음'
                                sub='정리할 수 없어요'
                                count={noDateImages.length}
                                onResolve={goNoDate}
                            />
                        )}
                    </section>
                )}

                <h3 css={sectionLabelStyle}>{selectMode ? '탭으로 추가 선택 / 해제' : '모든 사진'}</h3>

                {renderGroups.length === 0 && !selectMode ? (
                    <button type='button' css={emptyAddStyle} onClick={openFilePicker}>
                        <EmptyItem
                            title='등록된 사진이 없어요'
                            description='탭하여 첫 사진을 추가하세요'
                            icon={<ImageOff />}
                        />
                    </button>
                ) : (
                    renderGroups.map((g) => (
                        <DateGroupSection
                            key={g.recordDate}
                            label={g.recordDate}
                            photos={g.images}
                            pending={g.pending}
                            selected={selected}
                            selectMode={selectMode}
                            onToggle={togglePhoto}
                            onAdd={openFilePicker}
                        />
                    ))
                )}
            </main>

            {selectMode && (
                <SelectionActionFAB
                    selectedCount={selectedCount}
                    onEditLocation={handleEditLocation}
                    onEditDate={handleEditDate}
                    onDelete={() => setShowDeleteConfirm(true)}
                />
            )}

            {showDeleteConfirm && (
                <ConfirmModal
                    title={`${selectedList.length}장의 사진 삭제`}
                    description={`삭제한 여행 사진은 다시 복구할 수 없습니다.\n그래도 삭제하시겠습니까?`}
                    confirmText='삭제'
                    cancelText='취소'
                    confirmModal={handleDelete}
                    closeModal={() => setShowDeleteConfirm(false)}
                />
            )}

            {showDateSheet && (
                <InlineDatePickSheet
                    tripKey={tripKey}
                    targets={selectedList}
                    onClose={() => setShowDateSheet(false)}
                    onApplied={() => {
                        setShowDateSheet(false);
                        clearSelection();
                    }}
                />
            )}
        </div>
    );
};

const bodyStyle = css`
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 12px 16px 32px;
`;

const tripSummaryStyle = css`
    padding: 16px;
    margin-bottom: 16px;
    background: ${MANAGE_TOKENS.card};
    border: 1px solid ${MANAGE_TOKENS.border};
    border-radius: 14px;
`;

const summaryRowStyle = css`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 6px;
`;

const summaryTitleStyle = css`
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.3px;
    color: ${MANAGE_TOKENS.text.primary};
`;

const summaryCountStyle = css`
    font-size: 12px;
    font-weight: 500;
    color: ${MANAGE_TOKENS.text.muted};
`;

const summarySubStyle = css`
    margin: 0;
    font-size: 12px;
    color: ${MANAGE_TOKENS.text.label};
`;

const issueSectionStyle = css`
    margin-bottom: 16px;
`;

const sectionLabelStyle = css`
    margin: 0 4px 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: ${MANAGE_TOKENS.text.label};
`;

const emptyAddStyle = css`
    width: 100%;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
`;

const uploadChipStyle = css`
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    z-index: 60;
    padding: 10px 16px;
    border-radius: 999px;
    background: rgba(17, 17, 17, 0.92);
    color: #fff;
    font-family: ${MANAGE_TOKENS.font};
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.3px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
    backdrop-filter: blur(10px);
    pointer-events: none;
`;

export default TripImageManagePage;
