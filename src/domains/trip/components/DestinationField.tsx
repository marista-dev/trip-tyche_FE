import { useId, useMemo, useRef, useState } from 'react';

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
import theme from '@/shared/styles/theme';

const ACCENT = theme.COLORS.PRIMARY;

// 처음엔 대표 지역만 2줄(7개 + 더보기)로 보여준다. 나머지는 '더보기'와 검색으로 찾는다.
const FEATURED_REGIONS = ['제주', '부산', '서울', '강릉', '경주', '여수', '전주'];

interface DestinationFieldProps {
    value: string;
    onChange: (value: string) => void;
    /** 사진 위치로 추정한 여행지. 시트 맨 위에 추천으로 보여준다. */
    suggestion?: DetectedDestination | null;
    /** 폼에 보이는 라벨('여행지 *')의 id — 버튼을 '여행지, 부산'처럼 읽게 한다 */
    labelledBy?: string;
}

/**
 * 여행지 입력칸 + 선택 시트.
 *
 * 예전엔 검색 없는 드롭다운에 84개국을 가나다순으로 늘어놔, 국내 여행도 '대한민국'을 스크롤해 찾아야 했다.
 * 시트는 사진 위치 추천 → 국내 지역 → 다녀온 곳 → 전체 나라(ㄱㄴㄷ 인덱스) 순으로 보여주고,
 * 검색은 한글·초성·영어·공항 코드·별칭(하와이 → 미국)을 모두 받는다.
 */
const DestinationField = ({ value, onChange, suggestion, labelledBy }: DestinationFieldProps) => {
    const uid = useId();
    const valueId = `${uid}-value`;
    const sheetTitleId = `${uid}-title`;
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [showAllRegions, setShowAllRegions] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    const display = formatDestination(value);
    const { data: summaryResult } = useTripSummaryList(isOpen);

    // 다녀온 나라(국내는 지역 단위). 지금 고른 값과 추천은 따로 보여주므로 뺀다.
    const visited = useMemo(() => {
        const trips = summaryResult?.success ? summaryResult.data : [];
        const seen = new Set<string>();
        trips.forEach((t) => t.country && seen.add(t.country));
        // 작성 중인 여행의 임시값('미정' 등)처럼 목록에 없는 값은 뺀다.
        return [...seen]
            .filter((v) => v !== suggestion?.value)
            .filter((v) => {
                const { country, isDomestic } = parseDestination(v);
                return isDomestic || Boolean(country);
            })
            .slice(0, 6);
    }, [summaryResult, suggestion?.value]);

    const grouped = useMemo(() => {
        const groups = new Map<string, typeof overseasCountries>();
        overseasCountries.forEach((c) => {
            const letter = getIndexLetter(c.nameKo);
            groups.set(letter, [...(groups.get(letter) ?? []), c]);
        });
        return [...groups.entries()];
    }, []);

    const results = query.trim() ? searchDestinations(query) : null;

    const open = () => {
        setQuery('');
        setShowAllRegions(false);
        setIsOpen(true);
    };

    const select = (next: string) => {
        onChange(next);
        setIsOpen(false);
    };

    const scrollToLetter = (letter: string) => {
        const target = sectionRefs.current.get(letter);
        const list = listRef.current;
        if (target && list) list.scrollTo({ top: target.offsetTop - list.offsetTop, behavior: 'smooth' });
    };

    const isSelected = (v: string) => v === value;
    const isKoreaWithoutRegion = value === KOREA_VALUE;

    // 지금 고른 지역이 '더보기' 안쪽에 있으면 처음부터 펼쳐 보여준다.
    const selectedRegionHidden = regionOptions
        .filter((o) => !FEATURED_REGIONS.includes(o.name))
        .some((o) => o.value === value);
    const regionsShown =
        showAllRegions || selectedRegionHidden
            ? regionOptions
            : regionOptions.filter((o) => FEATURED_REGIONS.includes(o.name));
    const isExpanded = regionsShown.length === regionOptions.length;
    const suggestionDisplay = suggestion ? formatDestination(suggestion.value) : null;

    return (
        <>
            <button
                type='button'
                css={trigger}
                onClick={open}
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

            {/* 사진 위치로 해외 나라를 추정했지만 아직 안 골랐을 때 — 한 번에 고르게 한다 */}
            {!value && suggestion && !suggestion.isConfident && (
                <button type='button' css={hintButton} onClick={() => onChange(suggestion.value)}>
                    <MapPin size={12} />
                    사진 위치로 보면 {formatDestination(suggestion.value)?.emoji}{' '}
                    {formatDestination(suggestion.value)?.name} 같아요 · <strong>선택</strong>
                </button>
            )}

            <BottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)} maxHeight='88vh' labelledBy={sheetTitleId}>
                <div css={sheetBody}>
                    <h2 id={sheetTitleId} css={sheetTitle}>
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
                            <button
                                type='button'
                                css={clearButton}
                                onClick={() => setQuery('')}
                                aria-label='검색어 지우기'
                            >
                                <X size={14} />
                            </button>
                        )}
                    </label>

                    <div ref={listRef} css={scrollArea}>
                        {results ? (
                            results.length > 0 ? (
                                <ul css={rowList}>
                                    {results.map((o) => (
                                        <li key={o.value}>
                                            <button type='button' css={row} onClick={() => select(o.value)}>
                                                <span css={rowEmoji} aria-hidden>
                                                    {o.emoji}
                                                </span>
                                                <span css={rowName}>{o.name}</span>
                                                {o.sub && <span css={rowSub}>{o.sub}</span>}
                                                {isSelected(o.value) && <Check size={16} color={ACCENT} />}
                                            </button>
                                        </li>
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
                                        css={suggestionCard(isSelected(suggestion.value))}
                                        onClick={() => select(suggestion.value)}
                                    >
                                        <MapPin size={16} color={ACCENT} />
                                        <span css={suggestionText}>
                                            <span css={suggestionLabel}>사진 위치</span>
                                            <span css={rowName}>
                                                {suggestionDisplay.emoji} {suggestionDisplay.name}
                                            </span>
                                        </span>
                                        {isSelected(suggestion.value) ? (
                                            <Check size={16} color={ACCENT} />
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
                                                css={tile(isSelected(o.value))}
                                                onClick={() => select(o.value)}
                                            >
                                                {o.name}
                                            </button>
                                        ))}
                                        {isExpanded ? (
                                            <button
                                                type='button'
                                                css={tile(isKoreaWithoutRegion)}
                                                onClick={() => select(KOREA_VALUE)}
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
                                                        key={`visited-${v}`}
                                                        type='button'
                                                        css={tile(isSelected(v))}
                                                        onClick={() => select(v)}
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
                                    {grouped.map(([letter, countries]) => (
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
                                                    <li key={c.value}>
                                                        <button type='button' css={row} onClick={() => select(c.value)}>
                                                            <span css={rowEmoji} aria-hidden>
                                                                {c.emoji}
                                                            </span>
                                                            <span css={rowName}>{c.nameKo}</span>
                                                            <span css={rowSub}>{c.nameEn}</span>
                                                            {getCountryKey(value) === c.value && (
                                                                <Check size={16} color={ACCENT} />
                                                            )}
                                                        </button>
                                                    </li>
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
                            {grouped.map(([letter]) => (
                                <button
                                    key={letter}
                                    type='button'
                                    css={indexButton}
                                    onClick={() => scrollToLetter(letter)}
                                >
                                    {letter}
                                </button>
                            ))}
                        </nav>
                    )}
                </div>
            </BottomSheet>
        </>
    );
};

/* ── 입력칸 — 폼의 다른 입력칸과 같은 틀(fieldBox) ── */
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
        border-color: ${ACCENT};
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
    color: ${ACCENT};
    font-size: 11px;
    font-weight: 700;
`;

const triggerPlaceholder = css`
    color: ${COLORS.TEXT.PLACEHOLDER};
`;

const hintButton = css`
    ${fieldHelp};
    margin-top: 6px;
    margin-left: 2px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: none;
    background: none;
    cursor: pointer;

    strong {
        color: ${ACCENT};
    }
`;

/* ── 시트 ── */
const sheetBody = css`
    position: relative;
    display: flex;
    flex-direction: column;
    height: calc(88vh - 60px);
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
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 50%;
    background: ${COLORS.SLATE[300]};
    color: #fff;
    cursor: pointer;
`;

// 시트 자체는 드래그로 닫히므로 목록은 별도 스크롤 영역으로 둔다(터치 스크롤이 드래그에 먹히지 않게).
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
    border: 1px solid ${selected ? ACCENT : '${COLORS.SLATE[200]}'};
    background: ${selected ? '${COLORS.BACKGROUND.PRIMARY_LIGHT}' : '#fff'};
    color: ${selected ? ACCENT : '${COLORS.SLATE[700]}'};
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
    border: 1px solid ${selected ? ACCENT : 'rgba(0, 113, 227, 0.18)'};
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
    color: ${ACCENT};
`;

const suggestionAction = css`
    font-size: 13px;
    font-weight: 700;
    color: ${ACCENT};
`;

const letterHeader = css`
    position: sticky;
    top: 0;
    padding: 8px 0 4px;
    background: #fff;
    font-size: 12px;
    font-weight: 700;
    color: ${ACCENT};
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
    right: -6px;
    top: 120px;
    bottom: 8px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1px;
`;

const indexButton = css`
    width: 22px;
    padding: 1px 0;
    border: none;
    background: none;
    font-size: 10px;
    font-weight: 700;
    color: ${ACCENT};
    cursor: pointer;
`;

export default DestinationField;
