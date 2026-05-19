import { useState } from 'react';

interface SelectableItem {
    mediaFileId: number;
}

/**
 * 사진 선택 상태 (mediaFileId 기준 Set) 관리 훅.
 * Apple Photos 식 즉시 선택 패턴을 위한 표준화된 인터페이스.
 *
 * 의도적으로 thin: targets/filter는 호출 측이 들고 있고, 이 훅은 순수 선택 상태만 담당.
 * (사진 관리 페이지에서는 모든 사진 대상, 이슈 해결 페이지에서는 필터된 대상 등 다양한 컨텍스트 지원)
 */
export const usePhotoSelection = () => {
    const [selected, setSelected] = useState<Set<number>>(new Set());

    const toggle = (item: SelectableItem) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(item.mediaFileId)) next.delete(item.mediaFileId);
            else next.add(item.mediaFileId);
            return next;
        });
    };

    const clear = () => setSelected(new Set());

    return {
        selected,
        size: selected.size,
        selectMode: selected.size > 0,
        isSelected: (id: number) => selected.has(id),
        toggle,
        clear,
    };
};
