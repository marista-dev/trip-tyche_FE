import { ReactNode, Ref } from 'react';

import { css } from '@emotion/react';

import { notchMask } from '@/domains/trip/components/ticket/notchMask';
import { STUB_TORN_ATTR } from '@/domains/trip/components/ticket/stubCurl/stubTorn';
import { COLORS } from '@/shared/constants/style';

interface DayPassTicketProps {
    title: ReactNode;
    dateLine: string;
    /** 옆면에 세로로 쓰는 영문 지명 */
    placeEn: string;
    hashtags?: string[];
    photoUrl?: string;
    photoAlt?: string;
    fallbackBg: string;
    height: number;
    /** 브랜드 칩 옆에 붙는 라벨 (예: 공유받은 티켓) */
    badge?: ReactNode;
    /** 우측 상단 (더보기 버튼, 미리보기 배지) */
    action?: ReactNode;
    /** 옆면 요소 — 탭했을 때 말림 효과가 이 자리를 대신 그린다 */
    stubRef?: Ref<HTMLDivElement>;
}

/** 당일여행용 1-Day 패스. 사진 위에 유리 질감 옆면을 얹는다. */
const DayPassTicket = ({
    title,
    dateLine,
    placeEn,
    hashtags = [],
    photoUrl,
    photoAlt = '',
    fallbackBg,
    height,
    badge,
    action,
    stubRef,
}: DayPassTicketProps) => {
    const tags = hashtags.filter((tag) => tag !== '');

    return (
        <div css={shadowWrap} data-day-pass=''>
            <div css={pass(fallbackBg, height)}>
                {photoUrl && <img src={photoUrl} alt={photoAlt} css={photo} />}

                <div css={topRow}>
                    <div css={badgeGroup}>
                        <span css={brandChip}>
                            <span css={brandDot} />
                            TYCHE PASS
                        </span>
                        {badge}
                    </div>
                    {action}
                </div>

                <div css={info}>
                    {dateLine && <div css={dateText}>{dateLine}</div>}
                    <div css={titleText}>{title}</div>
                    {tags.length > 0 && (
                        <div css={tagGroup}>
                            {tags.map((tag, i) => (
                                <span key={`${tag}-${i}`} css={tagChip}>
                                    <span css={hash}>#</span>
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div ref={stubRef} css={stub}>
                    <b css={dayNumber}>1</b>
                    <span css={kickerGroup}>
                        <span css={stubKicker}>DAY</span>
                        <span css={stubKicker}>PASS</span>
                    </span>
                    {placeEn && <span css={stubPlace}>{placeEn}</span>}
                </div>
            </div>
        </div>
    );
};

const STUB_WIDTH = 82;

/** 절취선 구멍: 옆면 왼쪽 가장자리(테두리 2px 안쪽 1px)를 중심으로 위아래 반원 */
const NOTCH_RADIUS = 9;
const NOTCH_X = `calc(100% - ${STUB_WIDTH - 1}px)`;

// clip-path·mask가 그림자를 자르므로 그림자는 바깥에 둔다.
// box-shadow 대신 drop-shadow — 뚫린 구멍과 말림 효과로 옆면이 빠진 모양을 그림자가 따라간다
const shadowWrap = css`
    border-radius: 20px;
    filter: drop-shadow(0 10px 13px rgba(15, 23, 42, 0.16));
`;

// backdrop-filter 자식이 overflow:hidden 라운드를 벗어나는 문제 → isolate + clip-path로 자른다
const pass = (fallbackBg: string, height: number) => css`
    position: relative;
    height: ${height}px;
    border-radius: 20px;
    overflow: hidden;
    isolation: isolate;
    clip-path: inset(0 round 20px);
    ${notchMask(NOTCH_RADIUS, [
        [NOTCH_X, '0'],
        [NOTCH_X, '100%'],
    ])}
    color: #fff;
    background: ${fallbackBg};

    /* 옆면 자리를 잘라 낸다 — 그 자리는 WebGL 조각이 대신 그리고, 몸통 쪽 반쪽 구멍만 남는다 */
    [${STUB_TORN_ATTR}] > & {
        clip-path: inset(0 ${STUB_WIDTH}px 0 0 round 20px 0 0 20px);
    }

    &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.18) 0%,
            transparent 26%,
            transparent 44%,
            rgba(15, 23, 42, 0.5) 72%,
            rgba(15, 23, 42, 0.86) 100%
        );
        pointer-events: none;
    }
`;

// 오른쪽 옆면이 사진을 가리므로, 사진 중심을 보이는 영역(옆면 왼쪽)의 가운데에 맞춘다.
// 옆면 폭만큼 왼쪽으로 넓혀 카드 전체는 그대로 채운다 — 옆면 유리 뒤에도 진짜 사진이 흐려 보인다
const photo = css`
    position: absolute;
    top: 0;
    left: -${STUB_WIDTH}px;
    width: calc(100% + ${STUB_WIDTH}px);
    height: 100%;
    object-fit: cover;
    object-position: center 35%;
`;

const topRow = css`
    position: absolute;
    top: 13px;
    left: 13px;
    right: ${STUB_WIDTH + 14}px;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
`;

const badgeGroup = css`
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
`;

const brandChip = css`
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
    color: #fff;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.22);
    border-radius: 100px;
    backdrop-filter: blur(8px);
    display: inline-flex;
    align-items: center;
    gap: 6px;
`;

const brandDot = css`
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: ${COLORS.PRIMARY};
    flex-shrink: 0;
`;

const info = css`
    position: absolute;
    left: 16px;
    right: ${STUB_WIDTH + 16}px;
    bottom: 15px;
    z-index: 2;
`;

const dateText = css`
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    margin-bottom: 4px;
`;

const titleText = css`
    font-size: 19px;
    font-weight: 700;
    letter-spacing: -0.4px;
    line-height: 1.25;
    margin-bottom: 10px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: keep-all;
`;

const tagGroup = css`
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
`;

const tagChip = css`
    background: rgba(255, 255, 255, 0.2);
    padding: 3px 9px;
    border-radius: 100px;
    font-size: 11px;
    font-weight: 500;
    backdrop-filter: blur(6px);
`;

const hash = css`
    opacity: 0.6;
    margin-right: 1px;
`;

const stub = css`
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: ${STUB_WIDTH}px;
    z-index: 1;
    border-radius: 0 20px 20px 0;
    /* 절취선은 dashed 대신 그라디언트(6px 선 / 4px 간격) — 말림 효과의 캔버스 텍스처와 픽셀 단위로 맞춘다 */
    background:
        linear-gradient(rgba(255, 255, 255, 0.5) 0 6px, transparent 6px 10px) 0 0 / 2px 10px repeat-y border-box,
        rgba(15, 23, 42, 0.58);
    backdrop-filter: blur(24px) saturate(1.4);
    -webkit-backdrop-filter: blur(24px) saturate(1.4);
    box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.08);
    border-left: 2px solid transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
`;

const dayNumber = css`
    font-size: 34px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.04em;
`;

// DAY·PASS는 한 덩어리로 촘촘하게(1~2px), "1"과의 간격은 옆면 gap 그대로
const kickerGroup = css`
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.1;
`;

const stubKicker = css`
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 2.4px;
    padding-left: 2.4px;
`;

const stubPlace = css`
    margin-top: 12px;
    font-size: 10px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.7);
    writing-mode: vertical-rl;
    letter-spacing: 2.4px;
`;

export default DayPassTicket;
