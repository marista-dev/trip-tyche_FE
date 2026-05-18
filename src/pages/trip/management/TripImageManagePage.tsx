import { useMemo, useRef, useState } from 'react';

import { css } from '@emotion/react';
import { useQueryClient } from '@tanstack/react-query';
import { ImageOff } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import DateGroupSection from '@/domains/media/components/manage/DateGroupSection';
import IssueCard from '@/domains/media/components/manage/IssueCard';
import ManageHeader from '@/domains/media/components/manage/ManageHeader';
import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { useMediaDelete } from '@/domains/media/hooks/mutations';
import { useTripImages } from '@/domains/media/hooks/queries';
import { useImageUpload } from '@/domains/media/hooks/useImageUpload';
import { MediaFile } from '@/domains/media/types';
import {
    filterValidMediaFile,
    filterWithoutDateMediaFile,
    filterWithoutLocationMediaFile,
    getImageGroupByDate,
} from '@/domains/media/utils';
import { useTripInfo } from '@/domains/trip/hooks/queries';
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
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [uploadPhase, setUploadPhase] = useState<'idle' | 'extracting' | 'uploading'>('idle');

    const { data: imagesResult, isLoading: isImagesLoading } = useTripImages(tripKey);
    const { data: tripInfoResult } = useTripInfo(tripKey);
    const { mutate: deleteMutate, isPending: isDeleting } = useMediaDelete();
    const { extractMetaData, uploadImagesToS3, progress } = useImageUpload();

    const allImages: MediaFile[] = useMemo(
        () => (imagesResult?.success ? (imagesResult.data as MediaFile[]) : []),
        [imagesResult],
    );
    const tripInfo = tripInfoResult?.success ? tripInfoResult.data : undefined;

    const noLocImages = useMemo(() => filterWithoutLocationMediaFile(allImages) as MediaFile[], [allImages]);
    const noDateImages = useMemo(() => filterWithoutDateMediaFile(allImages) as MediaFile[], [allImages]);
    const validImages = useMemo(() => filterValidMediaFile(allImages) as MediaFile[], [allImages]);
    const groups = useMemo(() => getImageGroupByDate(validImages), [validImages]);

    const selectMode = selected.size > 0;
    const selectedList = useMemo(() => allImages.filter((img) => selected.has(img.mediaFileId)), [allImages, selected]);

    const togglePhoto = (photo: MediaFile) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(photo.mediaFileId)) next.delete(photo.mediaFileId);
            else next.add(photo.mediaFileId);
            return next;
        });
    };

    const clearSelection = () => setSelected(new Set());

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

    const openFilePicker = () => {
        if (uploadPhase !== 'idle') return;
        fileInputRef.current?.click();
    };

    const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const { files } = event.target;
        // 같은 파일을 연달아 선택할 수 있도록 즉시 초기화
        event.target.value = '';
        if (!files || files.length === 0) return;

        try {
            setUploadPhase('extracting');
            const uniqueFiles = await extractMetaData(files);
            setUploadPhase('uploading');
            await uploadImagesToS3(uniqueFiles);
            await queryClient.invalidateQueries({ queryKey: ['trip-images', tripKey] });
            showToast(`${uniqueFiles.length}장의 사진이 추가되었어요`);
        } catch {
            showToast('사진 추가 중 문제가 발생했어요. 다시 시도해주세요.');
        } finally {
            setUploadPhase('idle');
        }
    };

    const goNoLocation = () => navigate(ROUTES.PATH.TRIP.EDIT.NO_LOCATION(tripKey));
    const goNoDate = () => navigate(ROUTES.PATH.TRIP.EDIT.NO_DATE(tripKey));

    const totalCount = allImages.length;
    const hasIssues = noLocImages.length > 0 || noDateImages.length > 0;
    const dateRange = formatDateRange(tripInfo?.startDate, tripInfo?.endDate);

    const uploadingText =
        uploadPhase === 'extracting'
            ? `사진 정보를 분석 중... ${Math.round(progress?.metadata ?? 0)}%`
            : uploadPhase === 'uploading'
              ? `사진 업로드 중... ${Math.round(progress?.upload ?? 0)}%`
              : undefined;

    return (
        <div css={containerStyle}>
            {(isImagesLoading || isDeleting) && <Indicator text={isDeleting ? '사진 삭제 중...' : undefined} />}
            {uploadPhase !== 'idle' && <Indicator text={uploadingText} />}

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
                selectedCount={selected.size}
                onBack={() => navigate(ROUTES.PATH.TICKETS)}
                onCancel={clearSelection}
                onDelete={() => setShowDeleteConfirm(true)}
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

                {groups.length === 0 && !selectMode ? (
                    <button type='button' css={emptyAddStyle} onClick={openFilePicker}>
                        <EmptyItem
                            title='등록된 사진이 없어요'
                            description='탭하여 첫 사진을 추가하세요'
                            icon={<ImageOff />}
                        />
                    </button>
                ) : (
                    groups.map((g) => (
                        <DateGroupSection
                            key={g.recordDate}
                            label={g.recordDate}
                            photos={g.images}
                            selected={selected}
                            selectMode={selectMode}
                            onToggle={togglePhoto}
                            onAdd={openFilePicker}
                        />
                    ))
                )}
            </main>

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
        </div>
    );
};

const containerStyle = css`
    min-height: 100dvh;
    background: ${MANAGE_TOKENS.bg};
    color: ${MANAGE_TOKENS.text.primary};
    font-family: ${MANAGE_TOKENS.font};
`;

const bodyStyle = css`
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

export default TripImageManagePage;
