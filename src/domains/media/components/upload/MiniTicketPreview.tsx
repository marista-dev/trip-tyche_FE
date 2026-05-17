import { css } from '@emotion/react';
import { Plane } from 'lucide-react';

import { getIataFromCountryString } from '@/domains/trip/airport';
import { TICKET } from '@/domains/trip/constants';
import { TripInfo } from '@/domains/trip/types';
import { COLORS } from '@/shared/constants/style';

interface MiniTicketPreviewProps {
    trip: TripInfo;
    ownerNickname?: string;
    coverPhotoUrl?: string;
    photoCount?: number;
    sample?: boolean;
    isDayTrip?: boolean;
}

const ACCENT = COLORS.PRIMARY;

const formatShort = (iso: string) => {
    if (!iso) return '';
    const dt = new Date(iso);
    if (isNaN(+dt)) return iso;
    const yy = String(dt.getFullYear()).slice(2);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}`;
};

const seededHue = (seed: string) => (seed.charCodeAt(0) || 65) % 360;

const calcDuration = (start: string, end: string, isDayTrip: boolean) => {
    if (isDayTrip) return '당일치기';
    if (!start || !end) return '—';
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(+s) || isNaN(+e)) return '—';
    const days = Math.round((+e - +s) / 86400000) + 1;
    if (!isFinite(days) || days <= 0) return '—';
    if (days === 1) return '당일치기';
    return `${days - 1}박 ${days}일`;
};

const MiniTicketPreview = ({
    trip,
    ownerNickname = '여행자',
    coverPhotoUrl,
    photoCount,
    sample = false,
    isDayTrip = false,
}: MiniTicketPreviewProps) => {
    const destinationIata = getIataFromCountryString(trip.country);
    const hue = seededHue(trip.tripTitle || trip.country || 'A');
    const fallbackBg = `linear-gradient(135deg, oklch(0.7 0.08 ${hue}) 0%, oklch(0.35 0.08 ${(hue + 40) % 360}) 100%)`;

    const dateLine =
        trip.endDate && trip.endDate !== trip.startDate && !isDayTrip
            ? `${formatShort(trip.startDate)} — ${formatShort(trip.endDate)}`
            : formatShort(trip.startDate);

    const duration = calcDuration(trip.startDate, trip.endDate, isDayTrip);
    const photosLabel = typeof photoCount === 'number' ? `${photoCount}장` : '—';

    return (
        <div css={card}>
            <div css={top(fallbackBg)}>
                {coverPhotoUrl && <img src={coverPhotoUrl} alt={trip.tripTitle} css={coverImage} />}
                <div css={overlay} />
                <div css={brandChip}>
                    <span css={brandDot} />
                    TYCHE AIR
                </div>
                {sample && <div css={previewBadge}>미리보기</div>}
                <div css={topInfo}>
                    <div css={dateText}>{dateLine || '여행 기간'}</div>
                    <div css={titleText}>{trip.tripTitle || <span css={titleFaint}>여행 제목</span>}</div>
                </div>
            </div>
            <div css={bottom}>
                <span css={notchLeft} />
                <span css={notchRight} />
                <div css={routeRow}>
                    <div css={iata}>{TICKET.DEPARTURE_IATA}</div>
                    <div css={dashLine} />
                    <Plane size={13} color='#fff' />
                    <div css={dashLine} />
                    <div css={iataRight}>{destinationIata}</div>
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
                        <div css={metaValueAccent}>{photosLabel}</div>
                    </div>
                </div>
                {trip.hashtags?.length > 0 && (
                    <div css={tags}>
                        {trip.hashtags.map((t) => (
                            <span key={t} css={tag}>
                                <span css={hash}>#</span>
                                {t}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const card = css`
    position: relative;
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 14px 36px rgba(15, 23, 42, 0.18);
    background: #0f172a;
`;

const top = (fallback: string) => css`
    position: relative;
    height: 140px;
    background: ${fallback};
    overflow: hidden;
`;

const coverImage = css`
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
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
    background: ${ACCENT};
    margin-right: 5px;
`;

const previewBadge = css`
    position: absolute;
    top: 11px;
    right: 13px;
    font-size: 9px;
    font-weight: 700;
    color: #fff;
    padding: 3px 8px;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 100px;
`;

const topInfo = css`
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

const bottom = css`
    position: relative;
    background: #0f172a;
    color: #fff;
    padding: 14px 16px;
`;

const notchLeft = css`
    position: absolute;
    top: -7px;
    left: 18px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #f8fafc;
`;

const notchRight = css`
    position: absolute;
    top: -7px;
    right: 18px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #f8fafc;
`;

const routeRow = css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
`;

const iata = css`
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.04em;
`;

const iataRight = css`
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.04em;
    text-align: right;
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
    color: ${ACCENT};
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

const hash = css`
    color: ${ACCENT};
    font-weight: 700;
    margin-right: 2px;
`;

export default MiniTicketPreview;
