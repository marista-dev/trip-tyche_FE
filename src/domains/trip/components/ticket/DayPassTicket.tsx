import { ReactNode, Ref } from 'react';

import { css } from '@emotion/react';

import { notchMask } from '@/domains/trip/components/ticket/notchMask';
import { DAY_PASS_ROOT_PROPS, STUB_TORN_ATTR } from '@/domains/trip/components/ticket/stubCurl/stubTorn';
import { DAY_PASS_SHADE_STOPS, DAY_PASS_STUB, TICKET_RADIUS } from '@/domains/trip/components/ticket/ticketGeometry';
import { ticketPhoto } from '@/domains/trip/components/ticket/ticketPhoto';
import { COLORS } from '@/shared/constants/style';

interface DayPassTicketProps {
    title: ReactNode;
    dateLine: string;
    placeEn: string;
    hashtags?: string[];
    photoUrl?: string;
    photoAlt?: string;
    fallbackBg: string;
    height: number;
    badge?: ReactNode;
    action?: ReactNode;
    stubRef?: Ref<HTMLDivElement>;
}

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
    const visibleTags = hashtags.filter((tag) => tag !== '');

    return (
        <div css={shadowWrap} {...DAY_PASS_ROOT_PROPS}>
            <div css={passBody(fallbackBg, height)}>
                {photoUrl && <img src={photoUrl} alt={photoAlt} css={ticketPhoto} />}

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
                    {visibleTags.length > 0 && (
                        <div css={tagGroup}>
                            {visibleTags.map((tag, index) => (
                                <span key={`${tag}-${index}`} css={tagChip}>
                                    <span css={hashMark}>#</span>
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

const NOTCH_X = `calc(100% - ${DAY_PASS_STUB.width - DAY_PASS_STUB.notchOffsetX}px)`;
const SHADE_GRADIENT = `linear-gradient(180deg, ${DAY_PASS_SHADE_STOPS.map(({ color, percent }) => `${color} ${percent}%`).join(', ')})`;

// mask·clip-path가 그림자를 자르므로 바깥에 둔다. drop-shadow라야 구멍·말려 빠진 옆면 모양을 따라간다
const shadowWrap = css`
    border-radius: ${TICKET_RADIUS}px;
    filter: drop-shadow(0 10px 13px rgba(15, 23, 42, 0.16));
`;

// backdrop-filter 자식이 overflow:hidden 라운드를 벗어나므로 isolate + clip-path로 자른다
const passBody = (fallbackBg: string, height: number) => css`
    position: relative;
    height: ${height}px;
    border-radius: ${TICKET_RADIUS}px;
    overflow: hidden;
    isolation: isolate;
    clip-path: inset(0 round ${TICKET_RADIUS}px);
    ${notchMask(DAY_PASS_STUB.notchRadius, [
        [NOTCH_X, '0'],
        [NOTCH_X, '100%'],
    ])}
    color: #fff;
    background: ${fallbackBg};

    [${STUB_TORN_ATTR}] > & {
        clip-path: inset(0 ${DAY_PASS_STUB.width}px 0 0 round ${TICKET_RADIUS}px 0 0 ${TICKET_RADIUS}px);
    }

    &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: ${SHADE_GRADIENT};
        pointer-events: none;
    }
`;

const topRow = css`
    position: absolute;
    top: 13px;
    left: 13px;
    right: ${DAY_PASS_STUB.width + 14}px;
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
    right: ${DAY_PASS_STUB.width + 16}px;
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

const hashMark = css`
    opacity: 0.6;
    margin-right: 1px;
`;

const stub = css`
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: ${DAY_PASS_STUB.width}px;
    z-index: 1;
    border-radius: 0 ${TICKET_RADIUS}px ${TICKET_RADIUS}px 0;
    /* 절취선은 dashed 대신 그라디언트 — bakeStub의 캔버스 텍스처와 픽셀 단위로 맞춘다 */
    background:
        linear-gradient(
                ${DAY_PASS_STUB.perforationColor} 0 ${DAY_PASS_STUB.perforationDash}px,
                transparent ${DAY_PASS_STUB.perforationDash}px ${DAY_PASS_STUB.perforationPeriod}px
            )
            0 0 / ${DAY_PASS_STUB.perforationWidth}px ${DAY_PASS_STUB.perforationPeriod}px repeat-y border-box,
        ${DAY_PASS_STUB.glassColor};
    backdrop-filter: blur(${DAY_PASS_STUB.blurPx}px) saturate(${DAY_PASS_STUB.saturate});
    -webkit-backdrop-filter: blur(${DAY_PASS_STUB.blurPx}px) saturate(${DAY_PASS_STUB.saturate});
    box-shadow: inset 1px 0 0 ${DAY_PASS_STUB.highlightColor};
    border-left: ${DAY_PASS_STUB.perforationWidth}px solid transparent;
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
