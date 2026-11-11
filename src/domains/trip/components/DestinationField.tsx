import { useCallback, useId, useMemo, useRef, useState } from 'react';

import { css } from '@emotion/react';
import { Check, ChevronDown, Globe, MapPin, Search, X } from 'lucide-react';

import { FIELD, fieldBox, fieldHelp } from '@/domains/trip/components/formField';
import {
    DetectedDestination,
    formatDestination,
    getCountryKey,
    getIndexLetter,
    KOREA_VALUE,
    overseasCountries,
    parseDestination,
    regionOptions,
    searchDestinations,
} from '@/domains/trip/destinations';
import { useTripSummaryList } from '@/domains/trip/hooks/queries';
import BottomSheet from '@/shared/components/common/BottomSheet';
import { COLORS } from '@/shared/constants/style';

const { PRIMARY } = COLORS;

// 처음엔 2줄(7개 + 더보기)만 보인다.
const FEATURED_REGIONS = ['제주', '부산', '서울', '강릉', '경주', '여수', '전주'];
const FEATURED_OPTIONS = regionOptions.filter((o) => FEATURED_REGIONS.includes(o.name));

const COUNTRY_GROUPS = (() => {
    const groups = new Map<string, typeof overseasCountries>();
    overseasCountries.forEach((c) => {
        const letter = getIndexLetter(c.nameKo);
        groups.set(letter, [...(groups.get(letter) ?? []), c]);
    });
    return [...groups.entries()];
})();

interface DestinationFieldProps {
    value: string;
    onChange: (value: string) => void;
    /** 사진 위치로 추정한 여행지 */
    suggestion?: DetectedDestination | null;
    /** 폼에 보이는 라벨('여행지 *')의 id — 버튼을 '여행지, 부산'처럼 읽게 한다 */
    labelledBy?: string;
}

/** 여행지 입력칸 + 선택 시트 */
const DestinationField = ({ value, onChange, suggestion, labelledBy }: DestinationFieldProps) => {
    const uid = useId();
    const valueId = `${uid}-value`;
    const sheetTitleId = `${uid}-title`;
    const [isOpen, setIsOpen] = useState(false);
    const close = useCallback(() => setIsOpen(false), []);

    const display = formatDestination(value);
    const suggestionDisplay = suggestion ? formatDestination(suggestion.value) : null;

    const select = (next: string) => {
        onChange(next);
        close();
    };

    return (
        <>
            <button
                type='button'
                css={trigger}
                onClick={() => setIsOpen(true)}
                aria-haspopup='dialog'
                aria-labelledby={labelledBy ? `${labelledBy} ${valueId}` : undefined}
            >
                <Globe size={16} css={triggerIcon} />
                {display ? (
                    <span id={valueId} css={triggerValue}>
                        <span aria-hidden>{display.emoji}</span>
                        {display.name}
                        {display.sub && <span css={triggerSub}>{display.sub}</span>}
                    </span>
                ) : (
                    <span id={valueId} css={triggerPlaceholder}>
                        어디로 다녀왔나요?
                    </span>
                )}
                <ChevronDown size={16} css={triggerIcon} />
            </button>

            {/* 해외 추정은 자동 선택하지 않고 제안만 한다 */}
            {!value && suggestion && suggestionDisplay && !suggestion.isConfident && (
                <button type='button' css={hintButton} onClick={() => onChange(suggestion.value)}>
                    <MapPin size={12} />
                    사진 위치로 보면 {suggestionDisplay.emoji} {suggestionDisplay.name} 같아요 · <strong>선택</strong>
                </button>
            )}

            <BottomSheet isOpen={isOpen} onClose={close} maxHeight='88vh' height='88vh' labelledBy={sheetTitleId}>
                <DestinationSheet titleId={sheetTitleId} value={value} suggestion={suggestion} onSelect={select} />
            </BottomSheet>
        </>
    );
};

interface DestinationSheetProps {
    titleId: string;
    value: string;
    suggestion?: DetectedDestination | null;
    onSelect: (value: string) => void;
}

/** 시트가 열렸을 때만 그려진다 — 닫힌 동안 나라 목록을 만들지 않고, 열 때마다 검색어가 비워진다. */
const DestinationSheet = ({ titleId, value, suggestion, onSelect }: DestinationSheetProps) => {
    const [query, setQuery] = useState('');
    const [showAllRegions, setShowAllRegions] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const { data: summaryResult } = useTripSummaryList(true);
    const trips = summaryResult?.success ? summaryResult.data : undefined;

    // 다녀온 곳. 추천과 겹치는 값, 목록에 없는 임시값('미정' 등)은 뺀다.
    const visited = useMemo(
        () =>
            [...new Set((trips ?? []).map((t) => t.country).filter(Boolean))]
                .filter((v) => v !== suggestion?.value)
                .filter((v) => {
                    const { country, isDomestic } = parseDestination(v);
                    return isDomestic || Boolean(country);
                })
                .slice(0, 6),
        [trips, suggestion?.value],
    );

    const results = query.trim() ? searchDestinations(query) : null;
    const selectedCountry = getCountryKey(value);
    const suggestionDisplay = suggestion ? formatDestination(suggestion.value) : null;

    // 고른 지역이 접힌 쪽에 있으면 펼친다.
    const isExpanded =
        showAllRegions ||
        (!FEATURED_OPTIONS.some((o) => o.value === value) && regionOptions.some((o) => o.value === value));
    const regionsShown = isExpanded ? regionOptions : FEATURED_OPTIONS;

    const scrollToLetter = (letter: string) => {
        const target = sectionRefs.current.get(letter);
        const list = listRef.current;
        if (target && list) list.scrollTo({ top: target.offsetTop - list.offsetTop, behavior: 'smooth' });
    };

    return (
        <div css={sheetBody}>
            <h2 id={titleId} css={sheetTitle}>
                어디로 다녀왔나요?
            </h2>
            <label css={searchBox}>
                <Search size={16} color={COLORS.SLATE[500]} />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder='나라·지역 검색 (일본, ㅇㅂ, japan)'
                    aria-label='나라·지역 검색'
                    css={searchInput}
                    enterKeyHint='search'
                />
                {query && (
                    <button type='button' css={clearButton} onClick={() => setQuery('')} aria-label='검색어 지우기'>
                        <span>
                            <X size={12} aria-hidden='true' />
                        </span>
                    </button>
                )}
            </label>

            <div ref={listRef} css={scrollArea}>
                {results ? (
                    results.length > 0 ? (
                        <ul css={rowList}>
                            {results.map((o) => (
                                <OptionRow
                                    key={o.value}
                                    {...o}
                                    selected={o.value === value}
                                    onClick={() => onSelect(o.value)}
                                />
                            ))}
                        </ul>
                    ) : (
                        <p css={emptyText}>찾는 곳이 없어요. 나라 이름으로 검색해 보세요.</p>
                    )
                ) : (
                    <>
                        {suggestion && suggestionDisplay && (
                            <button
                                type='button'
                                css={suggestionCard(suggestion.value === value)}
                                onClick={() => onSelect(suggestion.value)}
                            >
                                <MapPin size={16} color={PRIMARY} />
                                <span css={suggestionText}>
                                    <span css={suggestionLabel}>사진 위치</span>
                                    <span css={rowName}>
                                        {suggestionDisplay.emoji} {suggestionDisplay.name}
                                    </span>
                                </span>
                                {suggestion.value === value ? (
                                    <Check size={16} color={PRIMARY} />
                                ) : (
                                    <span css={suggestionAction}>선택</span>
                                )}
                            </button>
                        )}

                        <section css={section}>
                            <h3 css={sectionLabel}>국내</h3>
                            <div css={tileGrid(4)}>
                                {regionsShown.map((o) => (
                                    <button
                                        key={o.value}
                                        type='button'
                                        css={tile(o.value === value)}
                                        onClick={() => onSelect(o.value)}
                                    >
                                        {o.name}
                                    </button>
                                ))}
                                {isExpanded ? (
                                    <button
                                        type='button'
                                        css={tile(value === KOREA_VALUE)}
                                        onClick={() => onSelect(KOREA_VALUE)}
                                    >
                                        그 외 지역
                                    </button>
                                ) : (
                                    <button
                                        type='button'
                                        css={[tile(false), moreTile]}
                                        onClick={() => setShowAllRegions(true)}
                                    >
                                        더보기
                                    </button>
                                )}
                            </div>
                        </section>

                        {visited.length > 0 && (
                            <section css={section}>
                                <h3 css={sectionLabel}>다녀온 곳</h3>
                                <div css={tileGrid(3)}>
                                    {visited.map((v) => {
                                        const d = formatDestination(v)!;
                                        return (
                                            <button
                                                key={v}
                                                type='button'
                                                css={tile(v === value)}
                                                onClick={() => onSelect(v)}
                                            >
                                                <span css={tileLabel}>
                                                    {d.emoji} {d.name}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        <section css={section}>
                            <h3 css={sectionLabel}>해외</h3>
                            {COUNTRY_GROUPS.map(([letter, countries]) => (
                                <div
                                    key={letter}
                                    ref={(el) => {
                                        if (el) sectionRefs.current.set(letter, el);
                                        else sectionRefs.current.delete(letter);
                                    }}
                                >
                                    <div css={letterHeader}>{letter}</div>
                                    <ul css={rowList}>
                                        {countries.map((c) => (
                                            <OptionRow
                                                key={c.value}
                                                emoji={c.emoji}
                                                name={c.nameKo}
                                                sub={c.nameEn}
                                                selected={selectedCountry === c.value}
                                                onClick={() => onSelect(c.value)}
                                            />
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </section>
                    </>
                )}
            </div>

            {!results && (
                <nav css={indexBar} aria-label='나라 이름 초성으로 이동'>
                    {COUNTRY_GROUPS.map(([letter]) => (
                        <button key={letter} type='button' css={indexButton} onClick={() => scrollToLetter(letter)}>
                            {letter}
                        </button>
                    ))}
                </nav>
            )}
        </div>
    );
};

interface OptionRowProps {
    emoji: string;
    name: string;
    sub?: string;
    selected: boolean;
    onClick: () => void;
}

const OptionRow = ({ emoji, name, sub, selected, onClick }: OptionRowProps) => (
    <li>
        <button type='button' css={row} onClick={onClick}>
            <span css={rowEmoji} aria-hidden>
                {emoji}
            </span>
            <span css={rowName}>{name}</span>
            {sub && <span css={rowSub}>{sub}</span>}
            {selected && <Check size={16} color={PRIMARY} />}
        </button>
    </li>
);

const trigger = css`
    ${fieldBox};
    width: 100%;
    height: ${FIELD.HEIGHT};
    padding: 0;
    display: grid;
    grid-template-columns: 40px 1fr 36px;
    align-items: center;
    cursor: pointer;
    text-align: left;
    -webkit-tap-highlight-color: transparent;

    &:focus-visible {
        outline: none;
        border-color: ${PRIMARY};
    }
`;

const triggerIcon = css`
    justify-self: center;
    color: ${COLORS.SLATE[500]};
`;

const triggerValue = css`
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    color: ${COLORS.TEXT.BLACK};
    white-space: nowrap;
    overflow: hidden;
`;

const triggerSub = css`
    padding: 2px 7px;
    border-radius: 999px;
    background: ${COLORS.BACKGROUND.PRIMARY_LIGHT};
    color: ${PRIMARY};
    font-size: 11px;
    font-weight: 700;
`;

const triggerPlaceholder = css`
    color: ${COLORS.TEXT.PLACEHOLDER};
`;

const hintButton = css`
    ${fieldHelp};
    margin-top: 0;
    margin-left: 2px;
    min-height: 32px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: none;
    background: none;
    cursor: pointer;

    strong {
        color: ${PRIMARY};
    }
`;

const sheetBody = css`
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
`;

const sheetTitle = css`
    margin: 0 0 12px;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.3px;
    color: ${COLORS.TEXT.BLACK};
`;

const searchBox = css`
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 12px;
    border-radius: 12px;
    background: ${COLORS.SLATE[100]};
    flex-shrink: 0;
`;

const searchInput = css`
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 16px; /* iOS가 16px 미만 입력칸에 포커스하면 화면을 확대한다 */
    font-family: inherit;
    color: ${COLORS.TEXT.BLACK};

    &::placeholder {
        color: ${COLORS.SLATE[500]};
        font-size: 14px;
    }
`;

const clearButton = css`
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    margin-right: -6px;
    border: none;
    background: none;
    cursor: pointer;

    span {
        display: grid;
        place-items: center;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: ${COLORS.SLATE[300]};
        color: ${COLORS.TEXT.WHITE};
    }
`;

// 터치 스크롤이 시트 드래그에 먹히지 않게 목록은 별도 스크롤 영역으로 둔다.
const scrollArea = css`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    margin-top: 8px;
    padding-right: 22px; /* 인덱스 바 자리 */
    -webkit-overflow-scrolling: touch;
`;

const section = css`
    padding-top: 16px;
`;

const sectionLabel = css`
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0 0 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.6px;
    color: ${COLORS.SLATE[500]};
`;

const tileGrid = (columns: number) => css`
    display: grid;
    grid-template-columns: repeat(${columns}, minmax(0, 1fr));
    gap: 8px;
`;

const tile = (selected: boolean) => css`
    height: 42px;
    padding: 0 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    border: 1px solid ${selected ? PRIMARY : COLORS.SLATE[200]};
    background: ${selected ? COLORS.BACKGROUND.PRIMARY_LIGHT : COLORS.BACKGROUND.WHITE};
    color: ${selected ? PRIMARY : COLORS.SLATE[700]};
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    white-space: nowrap;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &:active {
        transform: translateY(1px);
    }
`;

const moreTile = css`
    background: ${COLORS.BACKGROUND.GRAY_LIGHT};
    color: ${COLORS.SLATE[500]};
`;

const tileLabel = css`
    overflow: hidden;
    text-overflow: ellipsis;
`;

const suggestionCard = (selected: boolean) => css`
    width: 100%;
    margin-top: 16px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-radius: 14px;
    border: 1px solid ${selected ? PRIMARY : 'rgba(0, 113, 227, 0.18)'};
    background: rgba(0, 113, 227, 0.05);
    text-align: left;
    font-family: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
`;

const suggestionText = css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const suggestionLabel = css`
    font-size: 11px;
    font-weight: 700;
    color: ${PRIMARY};
`;

const suggestionAction = css`
    font-size: 13px;
    font-weight: 700;
    color: ${PRIMARY};
`;

const letterHeader = css`
    position: sticky;
    top: 0;
    padding: 8px 0 4px;
    background: ${COLORS.BACKGROUND.WHITE};
    font-size: 12px;
    font-weight: 700;
    color: ${PRIMARY};
`;

const rowList = css`
    list-style: none;
    margin: 0;
    padding: 0;
`;

const row = css`
    width: 100%;
    min-height: 48px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 4px;
    border: none;
    border-bottom: 1px solid ${COLORS.SLATE[100]};
    background: none;
    text-align: left;
    font-family: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &:active {
        background: ${COLORS.BACKGROUND.GRAY_LIGHT};
    }
`;

const rowEmoji = css`
    font-size: 20px;
    width: 24px;
    text-align: center;
`;

const rowName = css`
    font-size: 15px;
    font-weight: 600;
    color: ${COLORS.TEXT.BLACK};
`;

const rowSub = css`
    flex: 1;
    font-size: 11px;
    color: ${COLORS.SLATE[500]};
    letter-spacing: 0.3px;
`;

const emptyText = css`
    padding: 40px 0;
    text-align: center;
    font-size: 14px;
    color: ${COLORS.SLATE[500]};
`;

const indexBar = css`
    position: absolute;
    right: -10px;
    top: 120px;
    bottom: 8px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1px;
`;

// 글자는 작아도 한 칸에 28×24 이상(WCAG 2.5.8).
const indexButton = css`
    width: 28px;
    min-height: 24px;
    padding: 0;
    border: none;
    background: none;
    font-size: 10px;
    font-weight: 700;
    color: ${PRIMARY};
    cursor: pointer;
`;

export default DestinationField;
