import React, { useMemo } from 'react';

import { useNavigate, useParams } from 'react-router-dom';

import PillSelector from '@/domains/trip/components/PillSelector';
import { getDayLabels } from '@/domains/trip/dayLabels';
import { ROUTES } from '@/shared/constants/route';

interface DateSelectorProps {
    selectedDate: string;
    dates: string[];
    isDomestic?: boolean;
}

const toMonthDotDay = (date: string) => date.slice(5).replace('-', '.');

const DateSelector = React.memo(({ selectedDate, dates, isDomestic = false }: DateSelectorProps) => {
    const { tripKey } = useParams();
    const navigate = useNavigate();

    const pills = useMemo(
        () =>
            getDayLabels(dates, { isDomestic }).map(({ date, label }) => ({
                key: date,
                label,
                caption: toMonthDotDay(date),
            })),
        [dates, isDomestic],
    );

    const openDate = (date: string) => navigate(ROUTES.PATH.TRIP.IMAGE.BY_DATE(tripKey!, date), { replace: true });

    return <PillSelector pills={pills} activeKey={selectedDate} ariaLabel='날짜 선택' onSelect={openDate} />;
});

export default DateSelector;
