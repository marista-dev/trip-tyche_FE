import { useState } from 'react';

import { Clock, MapPin } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import IssueResolveLayout from '@/domains/media/components/manage/IssueResolveLayout';
import QuickActionChip from '@/domains/media/components/manage/QuickActionChip';
import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { useMediaDelete } from '@/domains/media/hooks/mutations';
import { useTripPhotos } from '@/domains/media/hooks/queries';
import { useIssueResolveState } from '@/domains/media/hooks/useIssueResolveState';
import { useEstimateStore } from '@/domains/media/stores/useEstimateStore';
import { MediaFile } from '@/domains/media/types';
import { filterWithoutLocationMediaFile } from '@/domains/media/utils';
import { ROUTES } from '@/shared/constants/route';
import { useToastStore } from '@/shared/stores/useToastStore';

const NoLocationResolvePage = () => {
    const { tripKey = '' } = useParams<{ tripKey: string }>();
    const navigate = useNavigate();
    const { showToast } = useToastStore();
    const setEstimateTargets = useEstimateStore((s) => s.setTargets);

    const [showDelete, setShowDelete] = useState(false);

    const { photos: allImages, isLoading } = useTripPhotos(tripKey);
    const { mutate: deleteMutate, isPending: isDeleting } = useMediaDelete();

    const { selected, targets, allSelected, selectedList, scope, toggle, toggleAll, clearSelection } =
        useIssueResolveState(allImages, (imgs) => filterWithoutLocationMediaFile(imgs) as MediaFile[]);

    const openTimeEstimate = () => {
        if (scope.length === 0) return showToast('처리할 사진이 없습니다.');
        setEstimateTargets({ mode: 'time', tripKey, targets: scope });
        navigate(ROUTES.PATH.TRIP.EDIT.ESTIMATE_TIME(tripKey));
    };

    const openMapPick = () => {
        if (scope.length === 0) return showToast('처리할 사진이 없습니다.');
        setEstimateTargets({ mode: 'map-pick', tripKey, targets: scope });
        navigate(ROUTES.PATH.TRIP.EDIT.MAP_PICK(tripKey));
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
            title='위치 정보 없음'
            subtitle={`${targets.length}장의 사진을 처리해주세요`}
            contextTone='red'
            contextIcon={<MapPin size={18} strokeWidth={2.2} color={MANAGE_TOKENS.destructive} />}
            contextText='GPS 정보가 없는 사진들이에요. 지도에서 위치를 선택하거나 비슷한 시간대 사진의 위치를 가져올 수 있어요.'
            quickActions={
                <>
                    <QuickActionChip
                        icon={<MapPin size={13} strokeWidth={2} />}
                        label='지도에서 선택'
                        onClick={openMapPick}
                    />
                    <QuickActionChip
                        icon={<Clock size={13} strokeWidth={2} />}
                        label='시간대로 자동 추정'
                        onClick={openTimeEstimate}
                    />
                </>
            }
            listTone='red'
            photoIssueLabel='위치 정보 없음'
            emptyText='처리할 위치 없는 사진이 없어요'
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
        />
    );
};

export default NoLocationResolvePage;
