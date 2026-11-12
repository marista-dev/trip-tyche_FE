import { css } from '@emotion/react';
import { Plane } from 'lucide-react';

import DayPassTicket from '@/domains/trip/components/ticket/DayPassTicket';
import { notchMask } from '@/domains/trip/components/ticket/notchMask';
import RouteEnd from '@/domains/trip/components/ticket/RouteEnd';
import { getTicketView } from '@/domains/trip/ticketView';
import { TripInfo } from '@/domains/trip/types';
import { COLORS } from '@/shared/constants/style';

interface MiniTicketPreviewProps {
    trip: TripInfo;
    ownerNickname?: string;
    coverPhotoUrl?: string;
    photoCount?: number;
    sample?: boolean;
    /** 정해지면 날짜 대신 이 값으로 1-Day 패스/탑승권을 고른다 — 등록·수정 화면은 당일여행 토글을 따른다 */
    dayTrip?: boolean;
}

const MiniTicketPreview = ({
    trip,
    ownerNickname = '여행자',
    coverPhotoUrl,
    photoCount,
    sample = false,
    dayTrip,
}: MiniTicketPreviewProps) => {
    const { from, to, placeEn, isDayTrip, dateLine, duration, fallbackBg } = getTicketView(trip);
    const photosLabel = typeof photoCount === 'number' ? `${photoCount}장` : '—';
    const title = trip.tripTitle || <span css={titleFaint}>여행 제목</span>;
    const previewBadgeEl = sample && <div css={previewBadge}>미리보기</div>;

    if (dayTrip ?? isDayTrip) {
        return (
            <DayPassTicket
                title={title}
                dateLine={dateLine || '여행 날짜'}
                placeEn={placeEn}
                hashtags={trip.hashtags}
                photoUrl={coverPhotoUrl}
                photoAlt={trip.tripTitle}
                fallbackBg={fallbackBg}
                // 등록 화면은 폼이 아래에 이어지므로 낮게. 그 외는 탑승권 미리보기(약 270px)와 맞춰 토글 때 폼이 밀리지 않게
                height={sample ? 208 : 270}
                action={previewBadgeEl}
            />
        );
    }

    return (
        <div css={cardShadow}>
            <div css={card}>
                <div css={top(fallbackBg)}>
                    {coverPhotoUrl && <img src={coverPhotoUrl} alt={trip.tripTitle} css={coverImage} />}
                    <div css={overlay} />
                    <div css={brandChip}>
                        <span css={brandDot} />
                        TYCHE AIR
                    </div>
                    {previewBadgeEl && <div css={previewBadgePosition}>{previewBadgeEl}</div>}
                    <div css={topInfo}>
                        <div css={dateText}>{dateLine || '여행 기간'}</div>
                        <div css={titleText}>{title}</div>
                    </div>
                </div>
                <div css={bottom}>
                    <div css={routeRow}>
                        <RouteEnd point={from} side='from' size={20} />
                        <div css={dashLine} />
                        <Plane size={13} color='#fff' />
                        <div css={dashLine} />
                        <RouteEnd point={to} side='to' size={20} />
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
        </div>
    );
};

const TOP_HEIGHT = 140;

// mask가 자기 box-shadow까지 자르므로 그림자는 바깥 요소에 둔다.
// 구멍이 카드 안쪽이라 box-shadow(테두리 안쪽엔 안 그려짐)여야 구멍 속이 회색이 아니라 배경 그대로 보인다
const cardShadow = css`
    border-radius: 18px;
    box-shadow: 0 14px 36px rgba(15, 23, 42, 0.18);
`;

// 사진과 띠 경계의 반원 구멍을 실제로 뚫는다 — 어느 페이지 배경 위에서도 자연스럽게
const card = css`
    position: relative;
    border-radius: 18px;
    overflow: hidden;
    background: ${COLORS.TICKET_BAND};
    ${notchMask(7, [
        ['25px', `${TOP_HEIGHT}px`],
        ['calc(100% - 25px)', `${TOP_HEIGHT}px`],
    ])}
`;

const top = (fallback: string) => css`
    position: relative;
    height: ${TOP_HEIGHT}px;
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
    background: ${COLORS.PRIMARY};
    margin-right: 5px;
`;

const previewBadgePosition = css`
    position: absolute;
    top: 11px;
    right: 13px;
`;

const previewBadge = css`
    flex-shrink: 0;
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

const hash = css`
    color: ${COLORS.PRIMARY};
    font-weight: 700;
    margin-right: 2px;
`;

export default MiniTicketPreview;
