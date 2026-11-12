import React, { useMemo } from 'react';

import PillSelector from '@/domains/trip/components/PillSelector';
import { findHourGroupAt, groupByHour } from '@/domains/trip/photoTimes';

interface TimeSelectorProps {
    recordDates: string[];
    activeIndex: number;
    onSelectPhotoIndex: (photoIndex: number) => void;
}

const TimeSelector = React.memo(({ recordDates, activeIndex, onSelectPhotoIndex }: TimeSelectorProps) => {
    const hourGroups = useMemo(() => groupByHour(recordDates), [recordDates]);
    const pills = useMemo(
        () => hourGroups.map(({ key, title, count }) => ({ key, label: title, caption: `${count}장` })),
        [hourGroups],
    );
    const activeKey = findHourGroupAt(hourGroups, activeIndex)?.key ?? '';

    const selectHourGroup = (key: string) => {
        const group = hourGroups.find((hourGroup) => hourGroup.key === key);
        if (group) onSelectPhotoIndex(group.startIndex);
    };

    return <PillSelector pills={pills} activeKey={activeKey} ariaLabel='시간대 선택' onSelect={selectHourGroup} />;
});

export default TimeSelector;
