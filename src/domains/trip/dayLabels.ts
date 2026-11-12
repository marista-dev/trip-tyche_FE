import { getTripDays } from '@/domains/trip/tripDates';

export interface DayLabel {
    date: string;
    label: string;
}

const getDayLabel = (dates: string[], index: number, isDomestic: boolean): string => {
    if (dates.length === 1) return '당일';
    if (index === dates.length - 1) return isDomestic ? '마지막 날' : '귀국';
    if (index === 0) return isDomestic ? 'Day 1' : '출국';
    return `Day ${getTripDays(dates[0], dates[index])}`;
};

/** 국내는 비행기를 타지 않으니 출국·귀국 대신 Day 1 · 마지막 날 */
export const getDayLabels = (dates: string[], { isDomestic = false }: { isDomestic?: boolean } = {}): DayLabel[] =>
    dates.map((date, index) => ({ date, label: getDayLabel(dates, index, isDomestic) }));
