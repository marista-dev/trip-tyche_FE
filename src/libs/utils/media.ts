export const addStartDateAndEndDateToImageDates = (
    tripStartDate: string,
    tripEndDate: string,
    imageDates: string[],
) => {
    const datesInsideTrip = imageDates.filter((date) => date > tripStartDate && date < tripEndDate);
    return [...new Set([tripStartDate, ...datesInsideTrip, tripEndDate])];
};
