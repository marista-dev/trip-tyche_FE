import { useState } from 'react';

import { css, keyframes } from '@emotion/react';
import { Plus, Trash } from 'lucide-react';

import ShareModal from '@/domains/share/components/ShareModal';
import { useTripImages } from '@/domains/media/hooks/queries';
import { getIataFromCountryString } from '@/domains/trip/airport';
import TripTicketActionSheet from '@/domains/trip/components/TripTicketActionSheet';
import { TICKET } from '@/domains/trip/constants';
import { Trip } from '@/domains/trip/types';
import useUserStore from '@/domains/user/stores/useUserStore';
import { formatHyphenToDot, formatToDot } from '@/libs/utils/date';
import ConfirmModal from '@/shared/components/common/Modal/ConfirmModal';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import { COLORS } from '@/shared/constants/style';
import { useTicketHandler } from '@/shared/hooks/useTicketHandler';
import { useTicketNavigation } from '@/shared/hooks/useTicketNavigation';
import { useToastStore } from '@/shared/stores/useToastStore';

const TripTicket = ({ tripInfo }: { tripInfo: Trip }) => {
    const {
        tripKey,
        tripTitle,
        country,
        startDate,
        endDate,
        hashtags,
        ownerNickname,
        sharedUsersNicknames,
        shareId,
        confirmed: isCompletedTrip,
    } = tripInfo;

    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const showToast = useToastStore((state) => state.showToast);
    const userInfo = useUserStore((state) => state.userInfo);
    const isGuest = useUserStore((state) => state.isGuest);

    const { isModalOpen, isDeleting, isUnLinking, handler, deleteTrip, unlinkShared, closeModal } = useTicketHandler(
        tripKey!,
        {
            onSuccess: (message) => showToast(message),
            onError: (message) => showToast(message),
        },
    );
    const { isAnimating, handleCardClick } = useTicketNavigation(tripKey!);

    const { data: imagesData } = useTripImages(tripKey ?? '');
    const mediaFiles = imagesData?.success ? imagesData.data : undefined;
    const coverPhoto = isCompletedTrip ? mediaFiles?.[0]?.mediaLink : undefined;
    const photosCount = mediaFiles !== undefined ? `${mediaFiles.length}장` : '—';

    if (isCompletedTrip === undefined) return null;

    const isOwner = userInfo?.nickname === ownerNickname;
    const destinationIata = isCompletedTrip ? getIataFromCountryString(country) : 'TYC';
    const formattedStartDate = isCompletedTrip ? formatToDot(startDate) : '—';
    const formattedEndDate = isCompletedTrip ? formatToDot(endDate) : '—';
    const sharedPeople = [ownerNickname || '', ...(sharedUsersNicknames || [])];

    const durationLabel = (() => {
        if (!isCompletedTrip) return '—';
        const days =
            Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return days > 1 ? `${days - 1}박 ${days}일` : '당일치기';
    })();

    const seedHue = (tripTitle.charCodeAt(0) + tripTitle.charCodeAt(tripTitle.length - 1)) % 360;
    const fallbackBg = `linear-gradient(135deg, oklch(0.7 0.08 ${seedHue}) 0%, oklch(0.35 0.08 ${seedHue + 40}) 100%)`;

    return (
        <div css={containerStyle}>
            {isDeleting && <Indicator text='여행 티켓 삭제 중...' />}
            {isUnLinking && <Indicator text='공유 티켓 삭제 중...' />}

            {!isCompletedTrip && (
                <div css={uncompletedOverlayStyle}>
                    <div css={uncompletedButtonsStyle}>
                        <button
                            css={uncompletedActionStyle}
                            onClick={() => handler.edit(isCompletedTrip)}
                            aria-label="여행 정보 이어서 작성하기"
                        >
                            <Plus size={14} aria-hidden="true" /> 여행 정보 이어서 작성하기
                        </button>
                        <div css={separatorStyle} aria-hidden="true" />
                        <button
                            css={uncompletedDeleteStyle}
                            onClick={() => handler.delete()}
                            aria-label="삭제하기"
                        >
                            <Trash size={14} aria-hidden="true" /> 삭제하기
                        </button>
                    </div>
                </div>
            )}

            <div onClick={handleCardClick} css={cardClickableStyle}>
                {/* Photo Hero */}
                <div css={photoHeroStyle(fallbackBg)}>
                    {coverPhoto && (
                        <img src={coverPhoto} alt={tripTitle} css={coverPhotoStyle} />
                    )}
                    <div css={gradientTopStyle} />
                    <div css={gradientBottomStyle} />

                    {/* TYCHE AIR badge */}
                    <div css={badgeContainerStyle}>
                        <span css={badgeStyle}>
                            <span css={badgeDotStyle} />
                            TYCHE AIR
                        </span>
                        {!isOwner && <span css={sharedLabelStyle}>공유받은 티켓</span>}
                    </div>

                    {/* Date + Title overlay */}
                    <div css={heroOverlayStyle}>
                        <div css={heroDateStyle}>
                            {formattedStartDate} — {formattedEndDate}
                        </div>
                        <div css={heroTitleStyle}>{tripTitle}</div>
                    </div>
                </div>

                {/* Boarding-pass band */}
                <div css={bandStyle}>
                    <div css={perfLeftStyle} />
                    <div css={perfRightStyle} />

                    {/* Route row */}
                    <div css={routeRowStyle}>
                        <div css={routeCodeStyle}>{TICKET.DEPARTURE_IATA}</div>
                        <div css={routeLineStyle}>
                            <div css={dashedLineStyle} />
                            <div css={dashedLineStyle} />
                            {isAnimating && (
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="#fff"
                                    css={planeTraverseStyle}
                                    aria-hidden="true"
                                >
                                    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z" />
                                </svg>
                            )}
                        </div>
                        <div css={[routeCodeStyle, css`text-align: right;`]}>{destinationIata}</div>
                    </div>

                    {/* Meta row */}
                    <div css={metaRowStyle}>
                        <div>
                            <div css={metaLabelStyle}>PASSENGER</div>
                            <div css={metaValueStyle}>{ownerNickname || '—'}</div>
                        </div>
                        <div>
                            <div css={metaLabelStyle}>DURATION</div>
                            <div css={metaValueStyle}>{durationLabel}</div>
                        </div>
                        <div>
                            <div css={metaLabelStyle}>PHOTOS</div>
                            <div css={[metaValueStyle, css`color: ${COLORS.PRIMARY};`]}>{photosCount}</div>
                        </div>
                    </div>

                    {/* Hashtags + ⋯ button */}
                    <div css={tagRowStyle}>
                        <div css={tagGroupStyle}>
                            {hashtags
                                .filter((tag) => tag !== '')
                                .map((tag, i) => (
                                    <span key={i} css={tagChipStyle}>
                                        <span css={css`color: ${COLORS.PRIMARY}; font-weight: 700;`}>#</span>
                                        {tag}
                                    </span>
                                ))}
                        </div>
                        <button
                            aria-label="옵션 더보기"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsSheetOpen(true);
                            }}
                            css={moreButtonStyle}
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="5" cy="12" r="1.5" />
                                <circle cx="12" cy="12" r="1.5" />
                                <circle cx="19" cy="12" r="1.5" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <TripTicketActionSheet
                open={isSheetOpen}
                onClose={() => setIsSheetOpen(false)}
                trip={{ tripTitle, country, coverPhoto }}
                isOwner={isOwner}
                isGuest={isGuest}
                isCompletedTrip={!!isCompletedTrip}
                handler={handler}
                onShare={() => setIsShareModalOpen(true)}
            />

            {isModalOpen && (
                <ConfirmModal
                    title={isOwner ? '여행 티켓을 삭제하시겠습니까?' : '공유를 해제하시겠습니까?'}
                    description={
                        isOwner
                            ? '여행 티켓을 삭제하면 해당 여행의 정보와 사진들은 다시 복구할 수 없습니다. 그래도 삭제하시겠습니까?'
                            : '공유를 해제하면 더 이상 이 여행 티켓에 접근할 수 없게 됩니다. 계속하시겠습니까?'
                    }
                    confirmText={isOwner ? '삭제' : '해제'}
                    cancelText='취소'
                    confirmModal={isOwner ? deleteTrip : () => unlinkShared(shareId!)}
                    closeModal={closeModal}
                />
            )}

            {isShareModalOpen && (
                <ShareModal
                    tripKey={tripKey!}
                    tripTitle={tripTitle}
                    isOwner={isOwner}
                    sharedPeople={sharedPeople}
                    startDate={formatHyphenToDot(startDate)}
                    endDate={formatHyphenToDot(endDate)}
                    onClose={() => setIsShareModalOpen(false)}
                />
            )}
        </div>
    );
};

/* ── Styles ────────────────────────────────────────────────────────── */

const containerStyle = css`
    width: 100%;
    margin-bottom: 8px;
    position: relative;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
    background: ${COLORS.TICKET_BAND};
    user-select: none;
`;

const cardClickableStyle = css`
    cursor: pointer;
`;

const photoHeroStyle = (fallbackBg: string) => css`
    position: relative;
    height: 220px;
    background: ${fallbackBg};
    overflow: hidden;
`;

const coverPhotoStyle = css`
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
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
    background: linear-gradient(to bottom, transparent 35%, rgba(15, 23, 42, 0.75) 90%, rgba(15, 23, 42, 0.95) 100%);
    pointer-events: none;
`;

const badgeContainerStyle = css`
    position: absolute;
    top: 12px;
    left: 14px;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 6px;
`;

const badgeStyle = css`
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

const badgeDotStyle = css`
    display: inline-block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: ${COLORS.PRIMARY};
    flex-shrink: 0;
`;

const sharedLabelStyle = css`
    font-size: 10px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    background: rgba(255, 255, 255, 0.15);
    border-radius: 100px;
    padding: 3px 8px;
    backdrop-filter: blur(8px);
`;

const heroOverlayStyle = css`
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

const perfLeftStyle = css`
    position: absolute;
    top: -8px;
    left: 20px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${COLORS.BACKGROUND.PRIMARY};
`;

const perfRightStyle = css`
    position: absolute;
    top: -8px;
    right: 20px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${COLORS.BACKGROUND.PRIMARY};
`;

const routeRowStyle = css`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
`;

const routeCodeStyle = css`
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1;
    color: #fff;
    flex-shrink: 0;
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

const moreButtonStyle = css`
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: rgba(255, 255, 255, 0.75);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    -webkit-tap-highlight-color: transparent;

    &:hover {
        background: rgba(255, 255, 255, 0.18);
    }
`;

const uncompletedOverlayStyle = css`
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.48);
    z-index: 9;
    cursor: pointer;
`;

const uncompletedButtonsStyle = css`
    display: flex;
    align-items: center;
    gap: 6px;
    color: #1d1d1f;
    background-color: #ffffff;
    border: none;
    border-radius: 24px;
    cursor: pointer;
    box-shadow: rgba(0, 0, 0, 0.22) 3px 5px 30px 0px;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: -0.224px;
`;

const uncompletedActionStyle = css`
    padding: 10px 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    color: ${COLORS.TEXT.DESCRIPTION};
    background: none;
    border: none;
    cursor: pointer;
`;

const uncompletedDeleteStyle = css`
    padding: 10px 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    border: none;
    color: ${COLORS.TEXT.ERROR};
    background: none;
    cursor: pointer;
`;

const separatorStyle = css`
    width: 1px;
    height: 60%;
    background: ${COLORS.BORDER};
    align-self: center;
    flex-shrink: 0;
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

export default TripTicket;
