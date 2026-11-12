const NO_TIME_KEY = 'none';

/** "2024-03-30T13:45:00" · "2024-03-30 13:45:00" 모두 읽는다 */
export const getPhotoHour = (recordDate?: string): number | null => {
    const match = recordDate?.slice(10).match(/(\d{2}):\d{2}/);
    if (!match) return null;
    const hour = Number(match[1]);
    return hour >= 0 && hour < 24 ? hour : null;
};

export const formatHour = (hour: number): string => `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}시`;

export interface HourGroup {
    key: string;
    hour: number | null;
    title: string;
    startIndex: number;
    count: number;
}

/** 사진 순서는 그대로 두고 이어지는 같은 시끼리만 묶는다 */
export const groupByHour = (recordDates: (string | undefined)[]): HourGroup[] =>
    recordDates.reduce<HourGroup[]>((groups, recordDate, index) => {
        const hour = getPhotoHour(recordDate);
        const lastGroup = groups[groups.length - 1];
        if (lastGroup && lastGroup.hour === hour) {
            lastGroup.count += 1;
            return groups;
        }
        groups.push({
            key: `${hour ?? NO_TIME_KEY}#${groups.length}`,
            hour,
            title: hour === null ? '시간 없음' : formatHour(hour),
            startIndex: index,
            count: 1,
        });
        return groups;
    }, []);

export const findHourGroupAt = (groups: HourGroup[], photoIndex: number): HourGroup | undefined =>
    groups.find((group) => photoIndex >= group.startIndex && photoIndex < group.startIndex + group.count);
