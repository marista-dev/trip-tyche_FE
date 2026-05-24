// YYYY-MM-DD
export const formatToYYYYMMDD = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

// YYYY년 MM월 DD일
export const formatToKorean = (dateString: string, isIncludeYear = false) => {
    if (!dateString) {
        return;
    }
    const [year, month, day] = dateString.split('-');

    if (!year || !month || !day) {
        return;
    }
    const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = daysOfWeek[new Date(dateString).getDay()];

    return isIncludeYear
        ? `${year}년 ${Number(month)}월 ${Number(day)}일 `
        : `${Number(month)}월 ${Number(day)}일 ${dayOfWeek}요일`;
};

// YYYY.MM.DD
export const formatToDot = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
};

// Date를 ISO(YYYY-MM-DDTHH:mm:ss) 문자열로 변환
export const formatToISOLocal = (date: Date | null): string => {
    if (!date) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

export const formatDateTime = (isoString: string, includeTime = true): string => {
    const date = new Date(isoString);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1);
    const day = String(date.getDate());
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return includeTime ? `${year}년 ${month}월 ${day}일 ${hours}시 ${minutes}분` : `${month}월 ${day}일`;
};

// --------------------------------
export const exceptTimeFromDateString = (dateString: string) => dateString.slice(0, 10);

// YYYY-MM-DD => YYYY.MM.DD
export const formatHyphenToDot = (dateString: string): string => {
    const [year, month, date] = dateString.split('-');

    return `${year}.${month}.${date}`;
};

// YYYY-MM-DDTHH:mm:ss => MM월 DD일 (요일)
export const formatKoreanShortDate = (dateString: string) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
};

// YYYY-MM-DDTHH:mm:ss => MM월 DD일
export const formatKoreanDate = (dateString: string, hasYear = false) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return hasYear ? `${year}년 ${month}월 ${day}일` : `${month}월 ${day}일`;
};

// YYYY-MM-DDTHH:mm:ss => 오전(후) HH:MM
export const formatKoreanTime = (dateString: string) => {
    const date = new Date(dateString);
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');

    let period = '오전';

    if (hours === 0) {
        hours = 12;
    } else if (hours === 12) {
        period = '오후';
    } else if (hours > 12) {
        hours -= 12;
        period = '오후';
    }

    return `${period} ${hours}:${minutes}`;
};
