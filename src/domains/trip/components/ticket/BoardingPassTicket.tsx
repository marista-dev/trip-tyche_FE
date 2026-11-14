import { ReactNode } from 'react';

import { css, keyframes } from '@emotion/react';

import { notchMask } from '@/domains/trip/components/ticket/notchMask';
import RouteEnd from '@/domains/trip/components/ticket/RouteEnd';
import { BOARDING_PASS, TICKET_RADIUS } from '@/domains/trip/components/ticket/ticketGeometry';
import { ticketPhoto } from '@/domains/trip/components/ticket/ticketPhoto';
import { RoutePoint } from '@/domains/trip/destinations';
import { COLORS } from '@/shared/constants/style';

interface BoardingPassTicketProps {
    title: string;
    dateLine: string;
    from: RoutePoint;
    to: RoutePoint;
    passenger: string;
    duration: string;
    photoCountLabel: string;
    hashtags: string[];
    photoUrl?: string;
    fallbackBg: string;
    badge?: ReactNode;
    action?: ReactNode;
    isPlaneFlying: boolean;
}

const BoardingPassTicket = ({
    title,
    dateLine,
    from,
    to,
    passenger,
    duration,
    photoCountLabel,
    hashtags,
    photoUrl,
    fallbackBg,
    badge,
    action,
    isPlaneFlying,
}: BoardingPassTicketProps) => (
    <div css={shadowWrapStyle}>
        <div css={cardStyle}>
            <div css={photoHeroStyle(fallbackBg)}>
                {photoUrl && <img src={photoUrl} alt={title} css={ticketPhoto} loading='lazy' decoding='async' />}
                <div css={gradientTopStyle} />
                <div css={gradientBottomStyle} />

                <div css={badgeGroupStyle}>
                    <span css={brandChipStyle}>
                        <span css={brandDotStyle} />
                        TYCHE AIR
                    </span>
                    {badge}
                </div>

                <div css={heroTextStyle}>
                    <div css={heroDateStyle}>{dateLine}</div>
                    <div css={heroTitleStyle}>{title}</div>
                </div>
            </div>

            <div css={bandStyle}>
                <div css={routeRowStyle}>
                    <RouteEnd point={from} side='from' />
                    <div css={routeLineStyle}>
                        <div css={dashedLineStyle} />
                        <div css={dashedLineStyle} />
                        {isPlaneFlying && <FlyingPlane />}
                    </div>
                    <RouteEnd point={to} side='to' />
                </div>

                <div css={metaRowStyle}>
                    <MetaItem label='PASSENGER' value={passenger} />
                    <MetaItem label='DURATION' value={duration} />
                    <MetaItem label='PHOTOS' value={photoCountLabel} isAccent />
                </div>

                <div css={tagRowStyle}>
                    <div css={tagGroupStyle}>
                        {hashtags
                            .filter((tag) => tag !== '')
                            .map((tag, index) => (
                                <span key={index} css={tagChipStyle}>
                                    <span css={hashMarkStyle}>#</span>
                                    {tag}
                                </span>
                            ))}
                    </div>
                    {action}
                </div>
            </div>
        </div>
    </div>
);

const MetaItem = ({ label, value, isAccent = false }: { label: string; value: string; isAccent?: boolean }) => (
    <div>
        <div css={metaLabelStyle}>{label}</div>
        <div css={[metaValueStyle, isAccent && metaValueAccentStyle]}>{value}</div>
    </div>
);

const FlyingPlane = () => (
    <svg width='14' height='14' viewBox='0 0 24 24' fill='#fff' css={planeTraverseStyle} aria-hidden='true'>
        <path d='M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z' />
    </svg>
);

/** 카드 모양(라운드 + 사진·띠 경계의 반원 구멍). 같은 모양으로 덮는 오버레이도 쓴다 */
export const boardingPassShape = css`
    border-radius: ${TICKET_RADIUS}px;
    ${notchMask(BOARDING_PASS.notchRadius, [
        [`${BOARDING_PASS.notchInset}px`, `${BOARDING_PASS.heroHeight}px`],
        [`calc(100% - ${BOARDING_PASS.notchInset}px)`, `${BOARDING_PASS.heroHeight}px`],
    ])}
`;

// 구멍이 카드 안쪽이라 drop-shadow면 구멍 속이 회색이 된다 — box-shadow는 테두리 안쪽에 그리지 않는다
const shadowWrapStyle = css`
    border-radius: ${TICKET_RADIUS}px;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
`;

const cardStyle = css`
    ${boardingPassShape}
    overflow: hidden;
    background: ${COLORS.TICKET_BAND};
`;

const photoHeroStyle = (fallbackBg: string) => css`
    position: relative;
    height: ${BOARDING_PASS.heroHeight}px;
    background: ${fallbackBg};
    overflow: hidden;
`;

const gradientTopStyle = css`
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.08) 0%, transparent 30%);
    pointer-events: none;
`;

const gradientBottomStyle = css`
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 55%, rgba(15, 23, 42, 0.7) 88%, rgba(15, 23, 42, 0.95) 100%);
    pointer-events: none;
`;

const badgeGroupStyle = css`
    position: absolute;
    top: 12px;
    left: 14px;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 6px;
`;

const brandChipStyle = css`
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #fff;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 100px;
    backdrop-filter: blur(8px);
    display: inline-flex;
    align-items: center;
    gap: 6px;
`;

const brandDotStyle = css`
    display: inline-block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: ${COLORS.PRIMARY};
    flex-shrink: 0;
`;

const heroTextStyle = css`
    position: absolute;
    bottom: 12px;
    left: 16px;
    right: 16px;
    z-index: 2;
`;

const heroDateStyle = css`
    font-size: 10px;
    color: rgba(255, 255, 255, 0.7);
    letter-spacing: 0.3px;
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 4px;
`;

const heroTitleStyle = css`
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    letter-spacing: -0.3px;
`;

const bandStyle = css`
    position: relative;
    background: ${COLORS.TICKET_BAND};
    color: #fff;
    padding: 16px 18px;
`;

const routeRowStyle = css`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
`;

const routeLineStyle = css`
    flex: 1;
    height: 16px;
    display: flex;
    align-items: center;
    min-width: 0;
    position: relative;
    overflow: hidden;
`;

const dashedLineStyle = css`
    flex: 1;
    height: 1px;
    background: repeating-linear-gradient(to right, rgba(255, 255, 255, 0.4) 0 3px, transparent 3px 7px);
`;

const metaRowStyle = css`
    display: flex;
    justify-content: space-between;
    gap: 12px;
`;

const metaLabelStyle = css`
    font-size: 9px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.45);
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 3px;
`;

const metaValueStyle = css`
    font-size: 12px;
    font-weight: 700;
    color: #fff;
`;

const metaValueAccentStyle = css`
    color: ${COLORS.PRIMARY};
`;

const tagRowStyle = css`
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 10px;
    margin-top: 12px;
`;

const tagGroupStyle = css`
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    flex: 1;
    min-width: 0;
`;

const tagChipStyle = css`
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    padding: 3px 9px;
    border-radius: 100px;
    font-size: 11px;
    display: inline-flex;
    gap: 2px;
`;

const hashMarkStyle = css`
    color: ${COLORS.PRIMARY};
    font-weight: 700;
`;

const planeTraverseKeyframes = keyframes`
    from { left: -4px; }
    to   { left: calc(100% - 10px); }
`;

const planeTraverseStyle = css`
    position: absolute;
    top: 50%;
    transform: translateY(-50%) rotate(90deg);
    animation: ${planeTraverseKeyframes} 900ms ease-in-out forwards;
    pointer-events: none;
`;

export default BoardingPassTicket;
