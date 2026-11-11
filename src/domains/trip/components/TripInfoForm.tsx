import { Dispatch, SetStateAction, useEffect, useState } from 'react';

import { css } from '@emotion/react';
import { Select } from '@mantine/core';
import { DatePickerInput, DatesRangeValue } from '@mantine/dates';
import 'dayjs/locale/ko';
import { Plane, Calendar, Globe, X } from 'lucide-react';

import { COUNTRIES, FORM } from '@/domains/trip/constants';
import {
    formatDuration,
    formatMonthDay,
    formatRange,
    getDateBounds,
    getDatesOutside,
    toDateString,
    toLocalDate,
    toPhotoDays,
} from '@/domains/trip/tripDates';
import { Trip } from '@/domains/trip/types';
import Input from '@/shared/components/common/Input';
import theme from '@/shared/styles/theme';

interface TripInfoFormProps {
    tripForm: Trip;
    onChangeTripInfo: Dispatch<SetStateAction<Trip>>;
}

const ACCENT = theme.COLORS.PRIMARY;
const HASHTAG_MAX = 3;
const HASHTAG_MAX_LEN = 12;
// 추천 태그 — 풀 메뉴는 너무 길어 가독성을 해치므로 대표 3개만 노출.
const HASHTAG_SUGGESTIONS = FORM.HASHTAG_MENU.slice(0, 3);

const TripInfoForm = ({ tripForm, onChangeTripInfo }: TripInfoFormProps) => {
    const { tripTitle, country, startDate, endDate, hashtags, mediaFilesDates = [] } = tripForm;
    const [tagInput, setTagInput] = useState('');
    // 시작일만 고른 '진행 중' 상태. 끝날까지 고르면 tripForm에 반영하고 비운다.
    const [draftRange, setDraftRange] = useState<DatesRangeValue | null>(null);

    const photoDays = toPhotoDays(mediaFilesDates);
    const photoBounds = getDateBounds(photoDays);
    const outsideDates = getDatesOutside(photoDays, startDate, endDate);

    const setRange = (start: string, end: string) =>
        onChangeTripInfo((prev: Trip) => ({ ...prev, startDate: start, endDate: end }));

    /*
     * 사진 날짜로 기간을 미리 채운다. 예전엔 사진 기간을 회색 placeholder로만 보여줘
     * 채워진 것처럼 보이는데 값은 비어 있어 '등록하기'가 막혔다.
     */
    useEffect(() => {
        if (!startDate && !endDate && photoBounds) setRange(photoBounds.start, photoBounds.end);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [photoBounds?.start, photoBounds?.end]);

    const handleDateChange = (value: DatesRangeValue) => {
        const [from, to] = value;
        if (from && to) {
            setDraftRange(null);
            setRange(toDateString(from), toDateString(to));
            return;
        }
        setDraftRange(value);
    };

    const pickerValue: DatesRangeValue = draftRange ?? [toLocalDate(startDate), toLocalDate(endDate)];
    const duration = formatDuration(startDate, endDate);
    const photoDaySet = new Set(photoDays);

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

    const countryData = COUNTRIES.map((country) => ({
        value: `${country.value}`,
        label: `${country.emoji} ${country.nameKo}`,
    }));

    return (
        <div css={card}>
            <section>
                <h2 css={[fieldLabel, labelGap]}>{FORM.TITLE.DATE}</h2>
                <DatePickerInput
                    type='range'
                    // 같은 날을 두 번 누르면 당일치기. 기본값(false)이면 선택이 풀려 하루짜리 여행을 못 고른다.
                    allowSingleDateInRange
                    placeholder='여행 기간을 선택해주세요'
                    value={pickerValue}
                    onChange={handleDateChange}
                    leftSection={<Calendar size={16} />}
                    locale='ko'
                    size='md'
                    radius='md'
                    valueFormatter={({ date }) =>
                        Array.isArray(date) ? formatRange(date[0] as Date | null, date[1] as Date | null) : ''
                    }
                    defaultDate={toLocalDate(startDate) ?? toLocalDate(photoBounds?.start) ?? undefined}
                    popoverProps={{ position: 'bottom', onClose: () => setDraftRange(null) }}
                    classNames={{ input: 'trip-date-input' }}
                    css={datePickerInputNowrap}
                    renderDay={(date) => (
                        <div css={dayContainerStyle}>
                            {photoDaySet.has(toDateString(date)) && <div css={dayIndicatorStyle} />}
                            {date.getDate()}
                        </div>
                    )}
                />
                <div css={dateMetaRow}>
                    {duration && (
                        <span css={durationBadge}>
                            <span css={durationDot} aria-hidden />
                            {duration}
                        </span>
                    )}
                    {outsideDates.length > 0 && photoBounds ? (
                        <span css={errorStyle}>
                            {formatMonthDay(outsideDates[0])}
                            {outsideDates.length > 1 && ` 외 ${outsideDates.length - 1}일`} 사진이 기간 밖에 있어요.
                            <button
                                type='button'
                                css={fitButton}
                                onClick={() => setRange(photoBounds.start, photoBounds.end)}
                            >
                                사진 날짜에 맞추기
                            </button>
                        </span>
                    ) : (
                        <span css={dateDescriptionStyle}>
                            {draftRange?.[0]
                                ? '끝나는 날을 골라주세요 · 같은 날을 한 번 더 누르면 당일치기'
                                : '사진이 있는 날짜는 파란 점으로 표시됩니다'}
                        </span>
                    )}
                </div>
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

const labelGap = css`
    margin-bottom: 12px;
`;

const fitButton = css`
    margin-left: 6px;
    padding: 0;
    border: none;
    background: none;
    color: ${ACCENT};
    font-size: inherit;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
`;

const fieldLabel = css`
    font-size: ${theme.FONT_SIZES.MD};
    font-weight: bold;
    color: ${theme.COLORS.TEXT.BLACK};
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

// 선택된 날(파란 배경) 위에서도 보이도록 흰 테두리를 두른다.
const dayIndicatorStyle = css`
    position: absolute;
    top: -2px;
    left: 50%;
    transform: translateX(-50%);
    width: 5px;
    height: 5px;
    background-color: ${theme.COLORS.PRIMARY};
    box-shadow: 0 0 0 1px #fff;
    border-radius: 50%;
    z-index: 2;
`;

export default TripInfoForm;
