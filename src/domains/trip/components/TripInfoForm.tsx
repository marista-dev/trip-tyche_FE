import { Dispatch, SetStateAction, useEffect, useState } from 'react';

import { css } from '@emotion/react';
import { Select } from '@mantine/core';
import { DatePickerInput, DayProps, DateValue, DatesRangeValue } from '@mantine/dates';
import 'dayjs/locale/ko';
import dayjs from 'dayjs';
import { Plane, Calendar, Globe, X } from 'lucide-react';

import { COUNTRIES, FORM } from '@/domains/trip/constants';
import { useTripDateRange } from '@/domains/trip/hooks/useTripDateRange';
import { Trip } from '@/domains/trip/types';
import Input from '@/shared/components/common/Input';
import theme from '@/shared/styles/theme';

// 여행 컨텍스트에 맞는 날짜 포맷 — 양쪽 날짜를 풀어 쓰고 요일을 함께 표기.
// 예: "2025.03.05 (수) ~ 03.09 (일)"  또는  "2024.12.31 (화) ~ 2025.01.05 (일)"
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const withWeekday = (d: dayjs.Dayjs, includeYear: boolean) =>
    `${d.format(includeYear ? 'YYYY.MM.DD' : 'MM.DD')} (${WEEKDAYS[d.day()]})`;

const formatCompactSingle = (d: Date | string) => withWeekday(dayjs(d), true);

const formatCompactRange = (start: Date | string | null, end: Date | string | null) => {
    if (!start) return '';
    if (!end) return formatCompactSingle(start);
    const s = dayjs(start);
    const e = dayjs(end);
    if (s.isSame(e, 'day')) return formatCompactSingle(start);
    if (s.year() !== e.year()) return `${withWeekday(s, true)} ~ ${withWeekday(e, true)}`;
    return `${withWeekday(s, true)} ~ ${withWeekday(e, false)}`;
};

// 기간 요약 — "당일" / "N박 N일"
const formatDuration = (start: string | null | undefined, end: string | null | undefined) => {
    if (!start || !end) return null;
    const days = dayjs(end).diff(dayjs(start), 'day') + 1;
    if (days <= 0) return null;
    if (days === 1) return '당일';
    return `${days - 1}박 ${days}일`;
};

type DateSelectType = 'range' | 'single';
type DateChangeHandler = (value: DateValue | DatesRangeValue) => void;
interface TripInfoFormProps {
    isEditing?: boolean;
    tripForm: Trip;
    onChangeTripInfo: Dispatch<SetStateAction<Trip>>;
}

const ACCENT = theme.COLORS.PRIMARY;
const HASHTAG_MAX = 3;
const HASHTAG_MAX_LEN = 12;
// 추천 태그 — 풀 메뉴는 너무 길어 가독성을 해치므로 대표 3개만 노출.
const HASHTAG_SUGGESTIONS = FORM.HASHTAG_MENU.slice(0, 3);

const TripInfoForm = ({ isEditing = false, tripForm, onChangeTripInfo }: TripInfoFormProps) => {
    const { tripTitle, country, startDate, endDate, hashtags, mediaFilesDates: imageDates = [] } = tripForm;
    const [dateSelectType, setDateSelectType] = useState<DateSelectType>('range');
    const [isSelectRange, setIsSelectRange] = useState<boolean>(true);
    const [tagInput, setTagInput] = useState('');

    const defaultStartDate = imageDates[0];
    const defaultEndDate = imageDates[imageDates.length - 1];

    const datePickerProps = useTripDateRange({
        imageDates,
        onChangeTripInfo,
    });

    useEffect(() => {
        if (imageDates.length === 1) {
            setIsSelectRange(false);
            setDateSelectType('single');
        }
    }, []);

    useEffect(() => {
        if (!isEditing) {
            datePickerProps?.resetDates();
        }
    }, [dateSelectType]);

    const toggleDayTrip = () => {
        const next = dateSelectType === 'range' ? 'single' : 'range';
        setDateSelectType(next);
        setIsSelectRange(next === 'range');
    };

    const isDayTrip = dateSelectType === 'single';

    const removeTag = (tag: string) => {
        onChangeTripInfo((prev: Trip) => ({
            ...prev,
            hashtags: prev.hashtags.filter((t) => t !== tag),
        }));
    };

    const addTag = (raw: string) => {
        const tag = raw.trim().replace(/^#+/, '').slice(0, HASHTAG_MAX_LEN);
        setTagInput('');
        if (!tag) return;
        onChangeTripInfo((prev: Trip) => {
            if (prev.hashtags.includes(tag)) return prev;
            if (prev.hashtags.length >= HASHTAG_MAX) return prev;
            return { ...prev, hashtags: [...prev.hashtags, tag] };
        });
    };

    const onTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(tagInput);
        } else if (e.key === 'Backspace' && !tagInput && hashtags.length) {
            removeTag(hashtags[hashtags.length - 1]);
        }
    };

    const remainingSuggestions = HASHTAG_SUGGESTIONS.filter((t) => !hashtags.includes(t));
    const isFull = hashtags.length >= HASHTAG_MAX;

    const handleDateChange: DateChangeHandler = (value) => {
        if (dateSelectType === 'range' && Array.isArray(value)) {
            datePickerProps?.handleRangeDateChange(value as [DateValue, DateValue]);
        } else if (dateSelectType === 'single' && !Array.isArray(value)) {
            datePickerProps?.handleSingleDateChange(value as DateValue);
        }
    };

    const renderCustomDay = (date: Date) => {
        const isImage = imageDates.some(
            (imageDate) => dayjs(imageDate).format('YYYY-MM-DD') === dayjs(date).format('YYYY-MM-DD'),
        );
        const isSelected = datePickerProps?.isStartOrEndDate(date) ?? false;

        return (
            <div css={dayContainerStyle}>
                {isImage && <div css={dayIndicatorStyle(isSelected)} />}
                {date.getDate()}
            </div>
        );
    };

    const countryData = COUNTRIES.map((country) => ({
        value: `${country.value}`,
        label: `${country.emoji} ${country.nameKo}`,
    }));

    return (
        <div css={card}>
            <section>
                <div css={titleRow}>
                    <h2 css={fieldLabel}>{FORM.TITLE.DATE}</h2>
                    <button type='button' css={togglePill} onClick={toggleDayTrip} aria-pressed={isDayTrip}>
                        <span css={toggleTrack(isDayTrip)}>
                            <span css={toggleKnob(isDayTrip)} />
                        </span>
                        <span css={toggleText(isDayTrip)}>당일치기</span>
                    </button>
                </div>
                <DatePickerInput
                    type={isSelectRange ? 'range' : 'default'}
                    placeholder={
                        !defaultStartDate || !defaultEndDate
                            ? '여행 기간을 선택해주세요'
                            : isSelectRange
                              ? formatCompactRange(defaultStartDate, defaultEndDate)
                              : formatCompactSingle(defaultStartDate)
                    }
                    value={
                        datePickerProps.isInitialized
                            ? isSelectRange
                                ? [startDate ? new Date(startDate) : null, endDate ? new Date(endDate) : null]
                                : startDate
                                  ? new Date(startDate)
                                  : null
                            : isSelectRange
                              ? datePickerProps?.dateRange
                              : datePickerProps?.selectedDate
                    }
                    leftSection={<Calendar size={16} />}
                    locale='ko'
                    size='md'
                    radius='md'
                    valueFormat='YYYY.MM.DD'
                    valueFormatter={({ type, date }) => {
                        if (type === 'range' && Array.isArray(date)) {
                            return formatCompactRange(date[0] as Date | null, date[1] as Date | null);
                        }
                        if (date instanceof Date) return formatCompactSingle(date);
                        return '';
                    }}
                    defaultDate={imageDates[0] ? new Date(imageDates[0]) : undefined}
                    onChange={handleDateChange}
                    onMouseLeave={datePickerProps?.handleDateMouseLeave}
                    popoverProps={{ position: 'bottom' }}
                    classNames={{ input: 'trip-date-input' }}
                    css={datePickerInputNowrap}
                    getDayProps={(date: Date) => {
                        const defaultProps: Omit<Partial<DayProps>, 'classNames' | 'styles' | 'vars'> = {
                            disabled: false,
                            onMouseEnter: () => {},
                            selected: false,
                        };

                        return (
                            datePickerProps?.getCustomDayProps(
                                date,
                                datePickerProps.handleDateMouseEnter,
                                dateSelectType,
                            ) ?? defaultProps
                        );
                    }}
                    renderDay={(date) => renderCustomDay(date)}
                />
                {(() => {
                    const duration = formatDuration(startDate, endDate);
                    return (
                        <div css={dateMetaRow}>
                            {duration && (
                                <span css={durationBadge}>
                                    <span css={durationDot} aria-hidden />
                                    {duration}
                                </span>
                            )}
                            {datePickerProps?.isError ? (
                                <span css={errorStyle}>
                                    선택하신 날짜 외에도 사진이 있어요.
                                    {isSelectRange && ' 기간을 다시 확인해 주세요.'}
                                </span>
                            ) : (
                                <span css={dateDescriptionStyle}>사진이 있는 날짜는 파란 점으로 표시됩니다</span>
                            )}
                        </div>
                    );
                })()}
            </section>

            <section>
                <h2 css={fieldLabel}>{FORM.TITLE.COUNTRY}</h2>
                <Select
                    placeholder={FORM.TITLE.COUNTRY_DEFAULT}
                    data={countryData}
                    value={country}
                    onChange={(value) => onChangeTripInfo({ ...tripForm, country: value || '' })}
                    checkIconPosition='right'
                    leftSection={<Globe size={16} />}
                    size='md'
                    radius='md'
                    allowDeselect={false}
                    comboboxProps={{ transitionProps: { transition: 'pop', duration: 200 }, dropdownPadding: 6 }}
                />
            </section>

            <section>
                <h2 css={fieldLabel}>{FORM.TITLE.TITLE}</h2>
                <Input
                    value={tripTitle}
                    onChange={(value) => onChangeTripInfo({ ...tripForm, tripTitle: value })}
                    placeholder='최대 12자까지 입력할 수 있습니다'
                    maxLength={12}
                    leftSection={<Plane size={16} />}
                />
            </section>

            <section>
                <div css={titleRow}>
                    <h2 css={fieldLabel}>{FORM.TITLE.HASHTAG}</h2>
                    <span css={hashtagCount(isFull)}>
                        {hashtags.length} / {HASHTAG_MAX}
                    </span>
                </div>

                <div css={hashtagInputWrap(isFull)}>
                    {hashtags.map((tag) => (
                        <span
                            key={tag}
                            css={selectedChip}
                            onClick={() => removeTag(tag)}
                            role='button'
                            aria-label={`${tag} 태그 제거`}
                        >
                            <span css={chipHash}>#</span>
                            {tag}
                            <X size={11} css={chipX} />
                        </span>
                    ))}
                    {!isFull && (
                        <input
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={onTagKeyDown}
                            onBlur={() => tagInput && addTag(tagInput)}
                            placeholder={hashtags.length === 0 ? '태그 입력 후 Enter' : '+ 추가'}
                            maxLength={HASHTAG_MAX_LEN}
                            css={tagInputStyle}
                        />
                    )}
                </div>

                {!isFull && remainingSuggestions.length > 0 && (
                    <div css={suggestionRow}>
                        <span css={suggestionLabel}>추천</span>
                        {remainingSuggestions.map((tag) => (
                            <button key={tag} type='button' css={suggestionChip} onClick={() => addTag(tag)}>
                                # {tag}
                            </button>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

const card = css`
    background: #fff;
    border-radius: 20px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    border: 1px solid #f1f5f9;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
`;

// 가장 긴 케이스(예: "2024.12.31 (화) ~ 2025.01.05 (일)")도 모바일에서 무조건
// 한 줄에 들어가도록 폰트 크기와 자간을 살짝 좁힘. nowrap + ellipsis는 최후 안전망.
const datePickerInputNowrap = css`
    .trip-date-input {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 13px;
        letter-spacing: -0.25px;
    }
`;

const titleRow = css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
`;

const fieldLabel = css`
    font-size: ${theme.FONT_SIZES.MD};
    font-weight: bold;
    color: ${theme.COLORS.TEXT.BLACK};
`;

const togglePill = css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    user-select: none;
    background: none;
    border: none;
    padding: 0;
`;

const toggleTrack = (on: boolean) => css`
    width: 36px;
    height: 20px;
    border-radius: 100px;
    background: ${on ? ACCENT : '#e2e8f0'};
    position: relative;
    transition: background 0.2s;
    flex-shrink: 0;
`;

const toggleKnob = (on: boolean) => css`
    position: absolute;
    top: 2px;
    left: ${on ? '17px' : '2px'};
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
    transition: left 0.2s;
`;

const toggleText = (on: boolean) => css`
    font-size: 11px;
    font-weight: 700;
    color: ${on ? ACCENT : '#94a3b8'};
    transition: color 0.2s;
`;

const hashtagCount = (isFull: boolean) => css`
    font-size: 11px;
    font-weight: 700;
    color: ${isFull ? ACCENT : '#94a3b8'};
    letter-spacing: 0.4px;
    transition: color 0.2s;
`;

const hashtagInputWrap = (isFull: boolean) => css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 10px 12px;
    background: #f8fafc;
    border-radius: 12px;
    border: 1.5px solid ${isFull ? 'transparent' : '#e2e8f0'};
    transition: border-color 0.2s;

    &:focus-within {
        border-color: ${ACCENT};
        background: #fff;
    }
`;

const selectedChip = css`
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 5px 9px 5px 10px;
    background: rgba(0, 113, 227, 0.08);
    color: ${ACCENT};
    font-size: 12px;
    font-weight: 600;
    border-radius: 100px;
    cursor: pointer;
    transition: background 0.15s;
    user-select: none;

    &:hover {
        background: rgba(0, 113, 227, 0.14);
    }
`;

const chipHash = css`
    color: ${ACCENT};
    font-weight: 700;
    margin-right: 1px;
`;

const chipX = css`
    margin-left: 2px;
    opacity: 0.55;
`;

const tagInputStyle = css`
    flex: 1;
    min-width: 80px;
    padding: 4px 0;
    background: transparent;
    border: none;
    outline: none;
    font-size: 13px;
    font-weight: 500;
    color: #0f172a;
    font-family: inherit;

    &::placeholder {
        color: #94a3b8;
        font-weight: 500;
    }
`;

const suggestionRow = css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-top: 10px;
`;

const suggestionLabel = css`
    font-size: 10px;
    font-weight: 700;
    color: #cbd5e1;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-right: 2px;
`;

const suggestionChip = css`
    padding: 5px 10px;
    background: #fff;
    border: 1px solid #e2e8f0;
    color: #475569;
    font-size: 12px;
    font-weight: 600;
    border-radius: 100px;
    cursor: pointer;
    transition:
        border-color 0.15s,
        background 0.15s,
        color 0.15s;

    &:hover {
        border-color: ${ACCENT};
        color: ${ACCENT};
        background: rgba(0, 113, 227, 0.04);
    }

    &:active {
        transform: translateY(1px);
    }
`;

const baseDescriptionStyle = css`
    font-size: ${theme.FONT_SIZES.SM};
    font-weight: normal;
    color: ${theme.COLORS.TEXT.DESCRIPTION};
`;

const dateDescriptionStyle = css`
    ${baseDescriptionStyle}
`;

const errorStyle = css`
    font-size: ${theme.FONT_SIZES.SM};
    color: ${theme.COLORS.TEXT.ERROR};
`;

const dateMetaRow = css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    margin-left: 4px;
`;

// 여행 기간 강조 칩 — 무성의해 보이지 않도록 시각적 무게 부여
const durationBadge = css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 9px;
    background: rgba(0, 113, 227, 0.08);
    color: ${ACCENT};
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: -0.1px;
`;

const durationDot = css`
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: ${ACCENT};
`;

const dayContainerStyle = css`
    position: relative;
`;

const dayIndicatorStyle = (isSelected?: boolean) => css`
    position: absolute;
    top: -2px;
    left: 50%;
    transform: translateX(-50%);
    width: 5px;
    height: 5px;
    background-color: ${isSelected ? 'white' : theme.COLORS.PRIMARY};
    border-radius: 50%;
    z-index: 2;
`;

export default TripInfoForm;
