import { useMemo, useState } from 'react';

import { MediaFile } from '@/domains/media/types';

/**
 * 이슈 해결 페이지(위치 없음 / 날짜 없음)에서 공통으로 쓰는 선택 상태 관리.
 * - targets: filterFn으로 추려낸 처리 대상
 * - selected: 사용자가 체크한 사진 ID 집합
 * - selectedList: targets ∩ selected
 * - scope: 선택된 게 있으면 selectedList, 없으면 targets 전체 (빠른 액션이 일괄 처리에 사용)
 */
export const useIssueResolveState = (
    allImages: MediaFile[],
    filterFn: (images: MediaFile[]) => MediaFile[],
) => {
    const [selected, setSelected] = useState<Set<number>>(new Set());

    const targets = useMemo(() => filterFn(allImages), [allImages, filterFn]);
    const allSelected = targets.length > 0 && selected.size === targets.length;
    const selectedList = useMemo(
        () => targets.filter((p) => selected.has(p.mediaFileId)),
        [targets, selected],
    );

    const scope = selectedList.length > 0 ? selectedList : targets;

    const toggle = (photo: MediaFile) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(photo.mediaFileId)) next.delete(photo.mediaFileId);
            else next.add(photo.mediaFileId);
            return next;
        });
    };

    const toggleAll = () =>
        setSelected(allSelected ? new Set() : new Set(targets.map((p) => p.mediaFileId)));

    const clearSelection = () => setSelected(new Set());

    return {
        selected,
        targets,
        allSelected,
        selectedList,
        scope,
        toggle,
        toggleAll,
        clearSelection,
    };
};
