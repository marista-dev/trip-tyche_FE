import { css } from '@emotion/react';
import { Plane } from 'lucide-react';

import DayPassTicket from '@/domains/trip/components/ticket/DayPassTicket';
import { notchMask } from '@/domains/trip/components/ticket/notchMask';
import RouteEnd from '@/domains/trip/components/ticket/RouteEnd';
import { DAY_PASS_HEIGHT } from '@/domains/trip/components/ticket/ticketGeometry';
import { ticketPhoto } from '@/domains/trip/components/ticket/ticketPhoto';
import { getTicketView } from '@/domains/trip/ticketView';
import { TripInfo } from '@/domains/trip/types';
import { COLORS } from '@/shared/constants/style';

interface MiniTicketPreviewProps {
    trip: TripInfo;
    ownerNickname?: string;
    coverPhotoUrl?: string;
    photoCount?: number;
    isSample?: boolean;
    /** 지정하면 날짜 대신 이 값으로 1-Day 패스/탑승권을 고른다 */
    isDayTrip?: boolean;
}

const MiniTicketPreview = ({
    trip,
    ownerNickname = '여행자',
    coverPhotoUrl,
    photoCount,
    isSample = false,
    isDayTrip,
}: MiniTicketPreviewProps) => {
    const ticketView = getTicketView(trip);
    const { from, to, placeEn, dateLine, duration, fallbackBg } = ticketView;
    const photoCountLabel = typeof photoCount === 'number' ? `${photoCount}장` : '—';
    const title = trip.tripTitle || <span css={titleFaint}>여행 제목</span>;
    const previewBadge = isSample && <div css={previewBadgeStyle}>미리보기</div>;

    if (isDayTrip ?? ticketView.isDayTrip) {
        return (
            <DayPassTicket
                title={title}
                dateLine={dateLine || '여행 날짜'}
                placeEn={placeEn}
                hashtags={trip.hashtags}
                photoUrl={coverPhotoUrl}
                photoAlt={trip.tripTitle}
                fallbackBg={fallbackBg}
                height={isSample ? DAY_PASS_HEIGHT.compactPreview : DAY_PASS_HEIGHT.preview}
                action={previewBadge}
            />
        );
    }

    return (
        <div css={cardShadow}>
            <div css={card}>
                <div css={hero(fallbackBg)}>
                    {coverPhotoUrl && <img src={coverPhotoUrl} alt={trip.tripTitle} css={ticketPhoto} />}
                    <div css={overlay} />
                    <div css={brandChip}>
                        <span css={brandDot} />
                        TYCHE AIR
                    </div>
                    {previewBadge && <div css={previewBadgePosition}>{previewBadge}</div>}
                    <div css={heroText}>
                        <div css={dateText}>{dateLine || '여행 기간'}</div>
                        <div css={titleText}>{title}</div>
                    </div>
                </div>
                <div css={band}>
                    <div css={routeRow}>
                        <RouteEnd point={from} side='from' codeFontSize={20} />
                        <div css={dashLine} />
                        <Plane size={13} color='#fff' />
                        <div css={dashLine} />
                        <RouteEnd point={to} side='to' codeFontSize={20} />
                    </div>
                    <div css={metaRow}>
                        <div>
                            <div css={metaLabel}>PASSENGER</div>
                            <div css={metaValue}>{ownerNickname}</div>
                        </div>
                        <div>
                            <div css={metaLabel}>DURATION</div>
                            <div css={metaValue}>{duration}</div>
                        </div>
                        <div>
                            <div css={metaLabel}>PHOTOS</div>
                            <div css={metaValueAccent}>{photoCountLabel}</div>
                        </div>
                    </div>
                    {trip.hashtags?.length > 0 && (
                        <div css={tags}>
                            {trip.hashtags.map((hashtag) => (
                                <span key={hashtag} css={tag}>
                                    <span css={hashMark}>#</span>
                                    {hashtag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const MINI_BOARDING_PASS = {
    radius: 18,
    heroHeight: 140,
    notchRadius: 7,
    notchInset: 25,
} as const;

const cardShadow = css`
    border-radius: ${MINI_BOARDING_PASS.radius}px;
    box-shadow: 0 14px 36px rgba(15, 23, 42, 0.18);
`;

const card = css`
    position: relative;
    border-radius: ${MINI_BOARDING_PASS.radius}px;
    overflow: hidden;
    background: ${COLORS.TICKET_BAND};
    ${notchMask(MINI_BOARDING_PASS.notchRadius, [
        [`${MINI_BOARDING_PASS.notchInset}px`, `${MINI_BOARDING_PASS.heroHeight}px`],
        [`calc(100% - ${MINI_BOARDING_PASS.notchInset}px)`, `${MINI_BOARDING_PASS.heroHeight}px`],
    ])}
`;

const hero = (fallbackBg: string) => css`
    position: relative;
    height: ${MINI_BOARDING_PASS.heroHeight}px;
    background: ${fallbackBg};
    overflow: hidden;
`;

const overlay = css`
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 35%, rgba(15, 23, 42, 0.85) 90%);
`;

const brandChip = css`
    position: absolute;
    top: 11px;
    left: 13px;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 2.4px;
    color: #fff;
    padding: 3px 9px;
    background: rgba(255, 255, 255, 0.22);
    border-radius: 100px;
    display: inline-flex;
    align-items: center;
`;

const brandDot = css`
    display: inline-block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: ${COLORS.PRIMARY};
    margin-right: 5px;
`;

const previewBadgePosition = css`
    position: absolute;
    top: 11px;
    right: 13px;
`;

const previewBadgeStyle = css`
    flex-shrink: 0;
    font-size: 9px;
    font-weight: 700;
    color: #fff;
    padding: 3px 8px;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 100px;
`;

const heroText = css`
    position: absolute;
    bottom: 12px;
    left: 16px;
    right: 16px;
`;

const dateText = css`
    font-size: 9.5px;
    color: rgba(255, 255, 255, 0.72);
    letter-spacing: 2px;
    font-weight: 600;
    margin-bottom: 4px;
`;

const titleText = css`
    font-size: 17px;
    font-weight: 700;
    color: #fff;
    letter-spacing: -0.3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const titleFaint = css`
    opacity: 0.55;
`;

const band = css`
    position: relative;
    background: ${COLORS.TICKET_BAND};
    color: #fff;
    padding: 14px 16px;
`;

const routeRow = css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
`;

const dashLine = css`
    flex: 1;
    height: 1px;
    background: repeating-linear-gradient(to right, rgba(255, 255, 255, 0.4) 0 3px, transparent 3px 7px);
`;

const metaRow = css`
    display: flex;
    justify-content: space-between;
`;

const metaLabel = css`
    font-size: 8.5px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.45);
    letter-spacing: 1.5px;
    margin-bottom: 2px;
`;

const metaValue = css`
    font-size: 11px;
    font-weight: 700;
`;

const metaValueAccent = css`
    font-size: 11px;
    font-weight: 700;
    color: ${COLORS.PRIMARY};
`;

const tags = css`
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 11px;
`;

const tag = css`
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.85);
    padding: 2px 8px;
    border-radius: 100px;
    font-size: 10.5px;
`;

const hashMark = css`
    color: ${COLORS.PRIMARY};
    font-weight: 700;
    margin-right: 2px;
`;

export default MiniTicketPreview;
