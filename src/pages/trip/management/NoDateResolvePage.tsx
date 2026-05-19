import { useMemo, useState } from 'react';

import { css } from '@emotion/react';
import { Calendar, MapPin } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import ManageHeader from '@/domains/media/components/manage/ManageHeader';
import PhotoListItem from '@/domains/media/components/manage/PhotoListItem';
import QuickActionChip from '@/domains/media/components/manage/QuickActionChip';
import { managePageContainerStyle } from '@/domains/media/components/manage/styles';
import TaskContextCard from '@/domains/media/components/manage/TaskContextCard';
import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { useMediaDelete } from '@/domains/media/hooks/mutations';
import { useTripPhotos } from '@/domains/media/hooks/queries';
import { useEstimateStore } from '@/domains/media/stores/useEstimateStore';
import { MediaFile } from '@/domains/media/types';
import { filterWithoutDateMediaFile } from '@/domains/media/utils';
import InlineDatePickSheet from '@/pages/trip/management/InlineDatePickSheet';
import ConfirmModal from '@/shared/components/common/Modal/ConfirmModal';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import { ROUTES } from '@/shared/constants/route';
import { useToastStore } from '@/shared/stores/useToastStore';

const NoDateResolvePage = () => {
    const { tripKey = '' } = useParams<{ tripKey: string }>();
    const navigate = useNavigate();
    const { showToast } = useToastStore();
    const setEstimateTargets = useEstimateStore((s) => s.setTargets);

    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [showDelete, setShowDelete] = useState(false);
    const [showDateSheet, setShowDateSheet] = useState(false);

    const { photos: allImages, isLoading } = useTripPhotos(tripKey);
    const { mutate: deleteMutate, isPending: isDeleting } = useMediaDelete();

    const targets = useMemo(() => filterWithoutDateMediaFile(allImages) as MediaFile[], [allImages]);

    const allSelected = targets.length > 0 && selected.size === targets.length;
    const selectedList = useMemo(() => targets.filter((p) => selected.has(p.mediaFileId)), [targets, selected]);

    const toggle = (photo: MediaFile) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(photo.mediaFileId)) next.delete(photo.mediaFileId);
            else next.add(photo.mediaFileId);
            return next;
        });
    };

    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(targets.map((p) => p.mediaFileId)));
    const clearSelection = () => setSelected(new Set());

    const scope = selectedList.length > 0 ? selectedList : targets;

    const openLocationEstimate = () => {
        if (scope.length === 0) {
            showToast('처리할 사진이 없습니다.');
            return;
        }
        setEstimateTargets({ mode: 'location', tripKey, targets: scope });
        navigate(ROUTES.PATH.TRIP.EDIT.ESTIMATE_LOCATION(tripKey));
    };

    const openDateSheet = () => {
        if (scope.length === 0) {
            showToast('처리할 사진이 없습니다.');
            return;
        }
        setShowDateSheet(true);
    };

    const handleDelete = () => {
        deleteMutate(
            { tripKey, images: selectedList },
            {
                onSuccess: (result) => {
                    showToast(result.success ? result.data : result.error);
                    setShowDelete(false);
                    clearSelection();
                },
            },
        );
    };

    return (
        <div css={managePageContainerStyle}>
            {(isLoading || isDeleting) && <Indicator text={isDeleting ? '사진 삭제 중...' : undefined} />}

            <ManageHeader
                title='날짜 정보 없음'
                subtitle={`${targets.length}장의 사진을 처리해주세요`}
                selectedCount={selected.size}
                onBack={() => navigate(-1)}
                onCancel={clearSelection}
                onDelete={() => setShowDelete(true)}
            />

            <TaskContextCard tone='amber' icon={<Calendar size={18} strokeWidth={2.2} color={MANAGE_TOKENS.warning} />}>
                촬영 날짜가 없는 사진이에요. 날짜를 입력하거나 같은 위치의 다른 사진 날짜를 가져올 수 있어요.
            </TaskContextCard>

            <div css={quickActionsStyle}>
                <QuickActionChip
                    icon={<Calendar size={13} strokeWidth={2} />}
                    label='날짜 입력'
                    onClick={openDateSheet}
                />
                <QuickActionChip
                    icon={<MapPin size={13} strokeWidth={2} />}
                    label='위치로 자동 추정'
                    onClick={openLocationEstimate}
                />
            </div>

            <main css={bodyStyle}>
                <div css={sectionHeadStyle}>
                    <h3 css={sectionLabelStyle}>처리 대상 · {targets.length}장</h3>
                    {targets.length > 0 && (
                        <button type='button' css={toggleAllStyle} onClick={toggleAll}>
                            {allSelected ? '모두 해제' : '모두 선택'}
                        </button>
                    )}
                </div>

                {targets.length === 0 ? (
                    <div css={emptyStyle}>처리할 날짜 없는 사진이 없어요</div>
                ) : (
                    <div css={listStyle}>
                        {targets.map((p, i) => (
                            <PhotoListItem
                                key={p.mediaFileId}
                                photo={p}
                                tone='amber'
                                selected={selected.has(p.mediaFileId)}
                                isFirst={i === 0}
                                onToggle={toggle}
                                primaryLabel='날짜 미지정'
                                issueLabel='날짜 정보 없음'
                            />
                        ))}
                    </div>
                )}
            </main>

            {showDelete && (
                <ConfirmModal
                    title={`${selectedList.length}장의 사진 삭제`}
                    description={`삭제한 여행 사진은 다시 복구할 수 없습니다.\n그래도 삭제하시겠습니까?`}
                    confirmText='삭제'
                    cancelText='취소'
                    confirmModal={handleDelete}
                    closeModal={() => setShowDelete(false)}
                />
            )}

            {showDateSheet && (
                <InlineDatePickSheet
                    tripKey={tripKey}
                    targets={scope}
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

const quickActionsStyle = css`
    display: flex;
    gap: 6px;
    padding: 0 20px 12px;
    background: ${MANAGE_TOKENS.card};
    border-bottom: 1px solid ${MANAGE_TOKENS.border};
`;

const bodyStyle = css`
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 12px 16px 32px;
`;

const sectionHeadStyle = css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 4px 10px;
`;

const sectionLabelStyle = css`
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: ${MANAGE_TOKENS.text.label};
`;

const toggleAllStyle = css`
    background: transparent;
    border: none;
    color: ${MANAGE_TOKENS.accent};
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
`;

const listStyle = css`
    background: ${MANAGE_TOKENS.card};
    border-radius: 12px;
    padding: 10px;
`;

const emptyStyle = css`
    padding: 40px 16px;
    text-align: center;
    color: ${MANAGE_TOKENS.text.muted};
    font-size: 13px;
    background: ${MANAGE_TOKENS.card};
    border-radius: 12px;
`;

export default NoDateResolvePage;
