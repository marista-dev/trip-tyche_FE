import dayjs from 'dayjs';

/*
 * 여행 날짜는 '하루' 단위로만 다룬다. 시각은 쓰지 않는다.
 *
 * 'YYYY-MM-DD'를 new Date()에 넘기면 UTC 자정으로 해석돼, 시간대에 따라 하루가 밀린다.
 * 날짜 문자열 ↔ Date 변환은 이 파일의 함수만 쓴다(로컬 자정 기준).
 */

const DATE_FORMAT = 'YYYY-MM-DD';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** 날짜 정보가 없는 사진에 서버가 채우는 값(DEFAULT_METADATA.DATE). 실제 날짜로 취급하지 않는다. */
const NO_DATE = '1980-01-01';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 'YYYY-MM-DD'(또는 'YYYY-MM-DDTHH:mm:ss') → 로컬 자정 Date. 비었거나 잘못된 값이면 null. */
export const toLocalDate = (value?: string | null): Date | null => {
    if (!value) return null;
    const day = value.slice(0, 10);
    if (!DATE_PATTERN.test(day)) return null;
    // dayjs는 날짜만 있는 ISO 문자열을 로컬 자정으로 해석한다(new Date는 UTC 자정).
    const d = dayjs(day);
    return d.isValid() ? d.toDate() : null;
};

/** Date → 'YYYY-MM-DD' (로컬 기준) */
export const toDateString = (date: Date): string => dayjs(date).format(DATE_FORMAT);

/** 실제 촬영 날짜만 'YYYY-MM-DD'로 추린다(날짜 없는 사진 제외). */
export const toPhotoDays = (dates: string[]): string[] =>
    dates.map((d) => (d ?? '').slice(0, 10)).filter((d) => DATE_PATTERN.test(d) && d !== NO_DATE);

/** 사진 날짜 목록에서 가장 이른 날과 늦은 날. 'YYYY-MM-DD' 문자열은 사전순 = 날짜순이다. */
export const getDateBounds = (dates: string[]): { start: string; end: string } | null => {
    const valid = toPhotoDays(dates);
    if (valid.length === 0) return null;
    const sorted = [...valid].sort();
    return { start: sorted[0], end: sorted[sorted.length - 1] };
};

/** 기간 밖에 있는 날짜(중복 제거, 정렬). 기간이 비었으면 빈 배열. */
export const getDatesOutside = (dates: string[], start?: string, end?: string): string[] => {
    if (!start || !end) return [];
    const s = start.slice(0, 10);
    const e = end.slice(0, 10);
    const outside = toPhotoDays(dates).filter((d) => d < s || d > e);
    return [...new Set(outside)].sort();
};

/** "당일치기" / "N박 N일". 기간이 비었거나 뒤집혔으면 null. */
export const formatDuration = (start?: string, end?: string): string | null => {
    const days = getTripDays(start, end);
    if (days === 0) return null;
    if (days === 1) return '당일치기';
    return `${days - 1}박 ${days}일`;
};

const withWeekday = (d: dayjs.Dayjs, includeYear: boolean) =>
    `${d.format(includeYear ? 'YYYY.MM.DD' : 'MM.DD')} (${WEEKDAYS[d.day()]})`;

/** "2025.03.05 (수) ~ 03.09 (일)" — 하루면 한쪽만, 해가 바뀌면 양쪽 모두 연도 표기. */
export const formatRange = (start: Date | null, end: Date | null): string => {
    if (!start) return '';
    const s = dayjs(start);
    if (!end || s.isSame(end, 'day')) return withWeekday(s, true);
    const e = dayjs(end);
    return `${withWeekday(s, true)} ~ ${withWeekday(e, s.year() !== e.year())}`;
};

/** "3월 4일" */
export const formatMonthDay = (date: string): string => {
    const d = dayjs(date.slice(0, 10));
    return `${d.month() + 1}월 ${d.date()}일`;
};

/** "2025.03.05" — 티켓·공유 화면의 날짜 표기. 잘못된 값이면 빈 문자열. */
export const formatDot = (value?: string): string => {
    const d = toLocalDate(value);
    return d ? dayjs(d).format('YYYY.MM.DD') : '';
};

/** 기간 일수(양 끝 포함). 비었거나 뒤집혔으면 0. */
export const getTripDays = (start?: string, end?: string): number => {
    if (!start || !end) return 0;
    const days = dayjs(end.slice(0, 10)).diff(dayjs(start.slice(0, 10)), 'day') + 1;
    return days > 0 ? days : 0;
};

/** "3월 5일–9일", 달이 바뀌면 "3월 30일–4월 2일", 하루면 "3월 5일" */
export const formatPeriod = (start: string, end: string): string => {
    const s = formatMonthDay(start);
    if (start.slice(0, 10) === end.slice(0, 10)) return s;
    const e = formatMonthDay(end);
    return start.slice(0, 7) === end.slice(0, 7) ? `${s}–${e.replace(/^\d+월\s/, '')}` : `${s}–${e}`;
};
