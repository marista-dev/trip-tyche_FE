import { useState } from 'react';

import { Calendar, MapPin } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import IssueResolveLayout from '@/domains/media/components/manage/IssueResolveLayout';
import QuickActionChip from '@/domains/media/components/manage/QuickActionChip';
import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { useMediaDelete } from '@/domains/media/hooks/mutations';
import { useTripPhotos } from '@/domains/media/hooks/queries';
import { useIssueResolveState } from '@/domains/media/hooks/useIssueResolveState';
import { useEstimateStore } from '@/domains/media/stores/useEstimateStore';
import { MediaFile } from '@/domains/media/types';
import { filterWithoutDateMediaFile } from '@/domains/media/utils';
import InlineDatePickSheet from '@/pages/trip/management/InlineDatePickSheet';
import { ROUTES } from '@/shared/constants/route';
import { useToastStore } from '@/shared/stores/useToastStore';

const NoDateResolvePage = () => {
    const { tripKey = '' } = useParams<{ tripKey: string }>();
    const navigate = useNavigate();
    const { showToast } = useToastStore();
    const setEstimateTargets = useEstimateStore((s) => s.setTargets);

    const [showDelete, setShowDelete] = useState(false);
    const [showDateSheet, setShowDateSheet] = useState(false);

    const { photos: allImages, isLoading } = useTripPhotos(tripKey);
    const { mutate: deleteMutate, isPending: isDeleting } = useMediaDelete();

    const { selected, targets, allSelected, selectedList, scope, toggle, toggleAll, clearSelection } =
        useIssueResolveState(allImages, (imgs) => filterWithoutDateMediaFile(imgs) as MediaFile[]);

    const openLocationEstimate = () => {
        if (scope.length === 0) return showToast('처리할 사진이 없습니다.');
        setEstimateTargets({ mode: 'location', tripKey, targets: scope });
        navigate(ROUTES.PATH.TRIP.EDIT.ESTIMATE_LOCATION(tripKey));
    };

    const openDateSheet = () => {
        if (scope.length === 0) return showToast('처리할 사진이 없습니다.');
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
        <IssueResolveLayout
            title='날짜 정보 없음'
            subtitle={`${targets.length}장의 사진을 처리해주세요`}
            contextTone='amber'
            contextIcon={<Calendar size={18} strokeWidth={2.2} color={MANAGE_TOKENS.warning} />}
            contextText='촬영 날짜가 없는 사진이에요. 날짜를 입력하거나 같은 위치의 다른 사진 날짜를 가져올 수 있어요.'
            quickActions={
                <>
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
                </>
            }
            listTone='amber'
            photoPrimaryLabel='날짜 미지정'
            photoIssueLabel='날짜 정보 없음'
            emptyText='처리할 날짜 없는 사진이 없어요'
            targets={targets}
            selected={selected}
            allSelected={allSelected}
            selectedCount={selected.size}
            isLoading={isLoading}
            isDeleting={isDeleting}
            onBack={() => navigate(-1)}
            onCancel={clearSelection}
            onDeleteRequest={() => setShowDelete(true)}
            onDeleteConfirm={handleDelete}
            onTogglePhoto={toggle}
            onToggleAll={toggleAll}
            showDeleteConfirm={showDelete}
            onCloseDeleteConfirm={() => setShowDelete(false)}
            deleteCount={selectedList.length}
            extraModals={
                showDateSheet && (
                    <InlineDatePickSheet
                        tripKey={tripKey}
                        targets={scope}
                        onClose={() => setShowDateSheet(false)}
                        onApplied={() => {
                            setShowDateSheet(false);
                            clearSelection();
                        }}
                    />
                )
            }
        />
    );
};

export default NoDateResolvePage;
