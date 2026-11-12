import { Dispatch, SetStateAction, useEffect, useId, useMemo, useRef, useState } from 'react';

import { css } from '@emotion/react';
import { Switch } from '@mantine/core';
import { DatePickerInput, DatesRangeValue, DateValue } from '@mantine/dates';
import 'dayjs/locale/ko';
import { Plane, Calendar, X } from 'lucide-react';

import DestinationField from '@/domains/trip/components/DestinationField';
import { FIELD, fieldBox, fieldHelp, fieldLabel, fieldOverrides } from '@/domains/trip/components/formField';
import { FORM } from '@/domains/trip/constants';
import { detectDestination, PhotoLocation } from '@/domains/trip/destinations';
import {
    formatDuration,
    formatDateSummary,
    formatRange,
    getDateBounds,
    getDatesOutside,
    toDateString,
    toLocalDate,
    toPhotoDays,
    TripRange,
} from '@/domains/trip/tripDates';
import { Trip } from '@/domains/trip/types';
import Input from '@/shared/components/common/Input';
import theme from '@/shared/styles/theme';

interface TripInfoFormProps {
    tripForm: Trip;
    onChangeTripInfo: Dispatch<SetStateAction<Trip>>;
    /** 여행지 추정용 사진 GPS */
    photoLocations?: PhotoLocation[];
    /** 당일여행 토글 상태 — 미리보기 티켓(AIR ↔ 1-Day 패스)을 토글에 맞춰 바꾼다 */
    onDayTripChange?: (isDayTrip: boolean) => void;
}

const { PRIMARY } = theme.COLORS;
const HASHTAG_MAX = 3;
const HASHTAG_MAX_LEN = 12;
const HASHTAG_SUGGESTIONS = FORM.HASHTAG_MENU.slice(0, 3);
const NO_DATES: string[] = [];
const NO_LOCATIONS: PhotoLocation[] = [];

const TripInfoForm = ({
    tripForm,
    onChangeTripInfo,
    photoLocations = NO_LOCATIONS,
    onDayTripChange,
}: TripInfoFormProps) => {
    const { tripTitle, country, startDate, endDate, hashtags, mediaFilesDates = NO_DATES } = tripForm;
    const [tagInput, setTagInput] = useState('');
    const labelId = useId();
    const ids = {
        date: `${labelId}-date`,
        country: `${labelId}-country`,
        title: `${labelId}-title`,
        tag: `${labelId}-tag`,
    };
    // 시작일만 고른 상태. 끝날까지 고르면 비운다.
    const [draftRange, setDraftRange] = useState<DatesRangeValue | null>(null);

    // 제목·태그를 칠 때마다 다시 계산하지 않게 사진 날짜가 바뀔 때만 계산한다.
    const { photoDays, photoDaySet, photoBounds } = useMemo(() => {
        const days = [...new Set(toPhotoDays(mediaFilesDates))];
        return { photoDays: days, photoDaySet: new Set(days), photoBounds: getDateBounds(days) };
    }, [mediaFilesDates]);
    const outsideDates = useMemo(() => getDatesOutside(photoDays, startDate, endDate), [photoDays, startDate, endDate]);

    // 날짜가 처음 채워질 때(사진 미리 채움·저장된 여행) 하루짜리면 당일여행을 켠다.
    const [isDayTrip, setIsDayTrip] = useState(Boolean(startDate) && startDate === endDate);
    const hasDatesRef = useRef(Boolean(startDate && endDate));
    useEffect(() => {
        if (!startDate || !endDate) {
            hasDatesRef.current = false;
            return;
        }
        if (hasDatesRef.current) return;
        hasDatesRef.current = true;
        setIsDayTrip(startDate === endDate);
    }, [startDate, endDate]);

    useEffect(() => {
        onDayTripChange?.(isDayTrip);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDayTrip]);

    const setRange = (start: string, end: string) =>
        onChangeTripInfo((prev: Trip) => ({ ...prev, startDate: start, endDate: end }));

    // 사진 날짜로 기간을 미리 채운다(placeholder만 두면 값이 비어 등록이 막힌다).
    useEffect(() => {
        if (!startDate && !endDate && photoBounds) setRange(photoBounds.start, photoBounds.end);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [photoBounds?.start, photoBounds?.end]);

    const detected = useMemo(() => detectDestination(photoLocations), [photoLocations]);

    // 국내 추정은 경계 판정이라 비어 있으면 바로 채우고, 해외는 추천만 한다.
    useEffect(() => {
        if (detected?.isConfident) {
            onChangeTripInfo((prev: Trip) => (prev.country ? prev : { ...prev, country: detected.value }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [detected?.value]);

    const handleDateChange = (value: DatesRangeValue) => {
        const [from, to] = value;
        if (from && to) {
            setDraftRange(null);
            setRange(toDateString(from), toDateString(to));
            if (toDateString(from) === toDateString(to)) setIsDayTrip(true);
            return;
        }
        setDraftRange(value);
    };

    const handleSingleDateChange = (value: DateValue) => {
        if (!value) return;
        const day = toDateString(value);
        setRange(day, day);
    };

    // 켜기 직전 기간. 날짜를 바꾸지 않고 다시 끄면 되돌린다.
    const rangeBeforeDayTripRef = useRef<TripRange | null>(null);

    const toggleDayTrip = () => {
        const next = !isDayTrip;
        setIsDayTrip(next);
        setDraftRange(null);
        if (next) {
            rangeBeforeDayTripRef.current = startDate && endDate ? { start: startDate, end: endDate } : null;
            if (startDate) setRange(startDate, startDate);
            return;
        }
        const before = rangeBeforeDayTripRef.current;
        rangeBeforeDayTripRef.current = null;
        if (before && startDate === before.start && endDate === before.start) {
            setRange(before.start, before.end);
            return;
        }
        // 되돌릴 기간이 없으면 끝나는 날을 비워 고르게 한다 — 하루짜리로 남으면 끈 토글과 티켓 모양이 어긋난다
        if (startDate && endDate === startDate) setRange(startDate, '');
    };

    const fitToPhotos = () => {
        if (!photoBounds) return;
        setRange(photoBounds.start, photoBounds.end);
        setIsDayTrip(photoBounds.start === photoBounds.end);
    };

    const pickerValue: DatesRangeValue = draftRange ?? [toLocalDate(startDate), toLocalDate(endDate)];
    const duration = formatDuration(startDate, endDate);
    const sharedPickerProps = {
        // 라벨과 선택된 값을 함께 읽게 한다
        id: `${ids.date}-value`,
        'aria-labelledby': `${ids.date} ${ids.date}-value`,
        leftSection: <Calendar size={16} />,
        locale: 'ko',
        size: 'md' as const,
        radius: 'md' as const,
        defaultDate: toLocalDate(startDate) ?? toLocalDate(photoBounds?.start) ?? undefined,
        popoverProps: { position: 'bottom' as const },
        classNames: { input: 'trip-date-input' },
        css: datePickerInputNowrap,
        renderDay: (date: Date) => (
            <div css={dayContainerStyle}>
                {photoDaySet.has(toDateString(date)) && <div css={dayIndicatorStyle} />}
                {date.getDate()}
            </div>
        ),
    };

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

    return (
        <div css={card}>
            <section>
                <div css={titleRow}>
                    <h2 id={ids.date} css={fieldLabel}>
                        {FORM.TITLE.DATE}
                    </h2>
                    <Switch
                        css={dayTripSwitch}
                        checked={isDayTrip}
                        onChange={toggleDayTrip}
                        label='당일여행'
                        labelPosition='left'
                        size='sm'
                        color={PRIMARY}
                    />
                </div>
                {isDayTrip ? (
                    <DatePickerInput
                        key='single'
                        placeholder='여행한 날을 선택해주세요'
                        value={toLocalDate(startDate)}
                        onChange={handleSingleDateChange}
                        {...sharedPickerProps}
                        valueFormatter={({ date }) => (date instanceof Date ? formatRange(date, null) : '')}
                    />
                ) : (
                    <DatePickerInput
                        key='range'
                        type='range'
                        // 없으면 같은 날을 두 번 누를 때 선택이 풀린다
                        allowSingleDateInRange
                        placeholder='여행 기간을 선택해주세요'
                        value={pickerValue}
                        onChange={handleDateChange}
                        {...sharedPickerProps}
                        valueFormatter={({ date }) =>
                            Array.isArray(date) ? formatRange(date[0] as Date | null, date[1] as Date | null) : ''
                        }
                        popoverProps={{ position: 'bottom', onClose: () => setDraftRange(null) }}
                    />
                )}
                <div css={dateMetaRow}>
                    {/* 당일여행이면 토글이 이미 보여준다 */}
                    {duration && !isDayTrip && (
                        <span css={durationBadge}>
                            <span css={durationDot} aria-hidden />
                            {duration}
                        </span>
                    )}
                    {outsideDates.length > 0 && photoBounds ? (
                        <span css={errorStyle}>
                            {formatDateSummary(outsideDates)} 사진이 기간 밖에 있어요.
                            <button type='button' css={fitButton} onClick={fitToPhotos}>
                                사진 날짜에 맞추기
                            </button>
                        </span>
                    ) : (
                        <span css={fieldHelp}>
                            {!isDayTrip && (draftRange?.[0] || (startDate && !endDate))
                                ? '끝나는 날을 골라주세요 · 같은 날을 한 번 더 누르면 당일여행'
                                : '사진이 있는 날짜는 파란 점으로 표시됩니다'}
                        </span>
                    )}
                </div>
            </section>

            <section>
                <h2 id={ids.country} css={fieldLabel}>
                    {FORM.TITLE.COUNTRY}
                </h2>
                <DestinationField
                    labelledBy={ids.country}
                    value={country}
                    onChange={(value) => onChangeTripInfo((prev: Trip) => ({ ...prev, country: value }))}
                    suggestion={detected}
                />
            </section>

            <section>
                <h2 id={ids.title} css={fieldLabel}>
                    {FORM.TITLE.TITLE}
                </h2>
                <Input
                    aria-labelledby={ids.title}
                    value={tripTitle}
                    onChange={(value) => onChangeTripInfo((prev: Trip) => ({ ...prev, tripTitle: value }))}
                    placeholder='최대 12자까지 입력할 수 있습니다'
                    maxLength={12}
                    leftSection={<Plane size={16} />}
                />
            </section>

            <section>
                <div css={titleRow}>
                    <h2 id={ids.tag} css={fieldLabel}>
                        {FORM.TITLE.HASHTAG}
                    </h2>
                    <span css={hashtagCount(isFull)}>
                        {hashtags.length} / {HASHTAG_MAX}
                    </span>
                </div>

                <div css={hashtagInputWrap(isFull)}>
                    {hashtags.map((tag) => (
                        <button
                            key={tag}
                            type='button'
                            css={selectedChip}
                            onClick={() => removeTag(tag)}
                            aria-label={`${tag} 태그 제거`}
                        >
                            <span css={chipHash}>#</span>
                            {tag}
                            <X size={11} css={chipX} aria-hidden='true' />
                        </button>
                    ))}
                    {!isFull && (
                        <input
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={onTagKeyDown}
                            onBlur={() => tagInput && addTag(tagInput)}
                            placeholder={hashtags.length === 0 ? '태그 입력 후 Enter' : '+ 추가'}
                            maxLength={HASHTAG_MAX_LEN}
                            aria-labelledby={ids.tag}
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
    ${fieldOverrides};
    background: ${theme.COLORS.BACKGROUND.WHITE};
    border-radius: 20px;
    padding: 18px 16px;
    display: flex;
    flex-direction: column;
    gap: ${FIELD.SECTION_GAP};
    border: 1px solid ${theme.COLORS.SLATE[100]};
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
`;

// 해가 바뀌는 기간("2024.12.31 (화) ~ 2025.01.05 (일)")도 한 줄에. ellipsis는 안전망.
const datePickerInputNowrap = css`
    .trip-date-input {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        letter-spacing: -0.25px;
    }
`;

const titleRow = css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${FIELD.LABEL_GAP};

    h2 {
        margin: 0;
    }
`;

// Mantine Switch에 폼 글자 규격을 맞추고, 줄 높이는 그대로 둔 채 터치 영역만 44px로 넓힌다.
const dayTripSwitch = css`
    .mantine-Switch-body {
        align-items: center;
        min-height: 44px;
        margin: -12px 0;
    }

    .mantine-Switch-label {
        padding-inline-end: 8px;
        font-size: ${FIELD.HELP_SIZE};
        font-weight: 600;
        color: ${theme.COLORS.SLATE[600]};
        cursor: pointer;
    }

    .mantine-Switch-track {
        cursor: pointer;
    }
`;

const fitButton = css`
    margin: -8px 0 -8px 4px;
    padding: 8px 2px;
    border: none;
    background: none;
    color: ${PRIMARY};
    font-size: inherit;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
`;

const hashtagCount = (isFull: boolean) => css`
    font-size: ${FIELD.HELP_SIZE};
    font-weight: 600;
    color: ${isFull ? PRIMARY : theme.COLORS.SLATE[500]};
    letter-spacing: 0.4px;
    transition: color 0.2s;
`;

const hashtagInputWrap = (isFull: boolean) => css`
    ${fieldBox};
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 6px 12px;
    ${isFull && `border-color: ${theme.COLORS.SLATE[200]};`}

    &:focus-within {
        border-color: ${PRIMARY};
    }
`;

const selectedChip = css`
    border: none;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 5px 9px 5px 10px;
    background: ${theme.COLORS.BACKGROUND.PRIMARY_LIGHT};
    color: ${PRIMARY};
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
    color: ${PRIMARY};
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
    font-size: ${FIELD.FONT_SIZE};
    color: ${theme.COLORS.TEXT.BLACK};
    font-family: inherit;

    &::placeholder {
        color: ${theme.COLORS.TEXT.PLACEHOLDER};
    }
`;

const suggestionRow = css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-top: 8px;
`;

const suggestionLabel = css`
    ${fieldHelp};
    margin-right: 2px;
`;

const suggestionChip = css`
    padding: 5px 10px;
    background: ${theme.COLORS.BACKGROUND.WHITE};
    border: 1px solid ${theme.COLORS.SLATE[200]};
    color: ${theme.COLORS.SLATE[600]};
    font-size: 12px;
    font-weight: 600;
    border-radius: 100px;
    cursor: pointer;
    transition:
        border-color 0.15s,
        background 0.15s,
        color 0.15s;

    &:hover {
        border-color: ${PRIMARY};
        color: ${PRIMARY};
        background: rgba(0, 113, 227, 0.04);
    }

    &:active {
        transform: translateY(1px);
    }
`;

const errorStyle = css`
    ${fieldHelp};
    color: ${theme.COLORS.TEXT.ERROR};
`;

const dateMetaRow = css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    margin-left: 2px;
`;

const durationBadge = css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    background: ${theme.COLORS.BACKGROUND.PRIMARY_LIGHT};
    color: ${PRIMARY};
    border-radius: 999px;
    font-size: ${FIELD.HELP_SIZE};
    font-weight: 600;
    letter-spacing: -0.1px;
`;

const durationDot = css`
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: ${PRIMARY};
`;

const dayContainerStyle = css`
    position: relative;
`;

// 선택된 날(파란 배경) 위에서도 보이게
const dayIndicatorStyle = css`
    position: absolute;
    top: -2px;
    left: 50%;
    transform: translateX(-50%);
    width: 5px;
    height: 5px;
    background-color: ${theme.COLORS.PRIMARY};
    box-shadow: 0 0 0 1px ${theme.COLORS.BACKGROUND.WHITE};
    border-radius: 50%;
    z-index: 2;
`;

export default TripInfoForm;
