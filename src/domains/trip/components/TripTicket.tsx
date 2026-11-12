import { useState } from 'react';

import { css } from '@emotion/react';

import { useTripImages } from '@/domains/media/hooks/queries';
import ShareModal from '@/domains/share/components/ShareModal';
import BoardingPassTicket from '@/domains/trip/components/ticket/BoardingPassTicket';
import DayPassTicket from '@/domains/trip/components/ticket/DayPassTicket';
import DraftTicketOverlay from '@/domains/trip/components/ticket/DraftTicketOverlay';
import { useStubCurl } from '@/domains/trip/components/ticket/stubCurl/useStubCurl';
import { DAY_PASS_HEIGHT } from '@/domains/trip/components/ticket/ticketGeometry';
import TicketMoreButton from '@/domains/trip/components/ticket/TicketMoreButton';
import TripTicketActionSheet from '@/domains/trip/components/TripTicketActionSheet';
import { getTicketView } from '@/domains/trip/ticketView';
import { Trip } from '@/domains/trip/types';
import { useMemberOnly } from '@/domains/user/hooks/useMemberOnly';
import { useLoginPromptStore } from '@/domains/user/stores/useLoginPromptStore';
import useUserStore from '@/domains/user/stores/useUserStore';
import ConfirmModal from '@/shared/components/common/Modal/ConfirmModal';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import { useTicketHandler } from '@/shared/hooks/useTicketHandler';
import { useTicketNavigation } from '@/shared/hooks/useTicketNavigation';
import { useToastStore } from '@/shared/stores/useToastStore';

const REMOVE_CONFIRM_COPY = {
    owner: {
        title: '여행 티켓을 삭제하시겠습니까?',
        description:
            '여행 티켓을 삭제하면 해당 여행의 정보와 사진들은 다시 복구할 수 없습니다. 그래도 삭제하시겠습니까?',
        confirmText: '삭제',
    },
    shared: {
        title: '공유를 해제하시겠습니까?',
        description: '공유를 해제하면 더 이상 이 여행 티켓에 접근할 수 없게 됩니다. 계속하시겠습니까?',
        confirmText: '해제',
    },
};

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
    const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
    const showToast = useToastStore((state) => state.showToast);
    const userInfo = useUserStore((state) => state.userInfo);
    const isGuest = useUserStore((state) => state.isGuest);
    const requireMember = useMemberOnly();
    const openLoginPrompt = useLoginPromptStore((state) => state.open);

    const { isModalOpen, isDeleting, isUnLinking, handler, deleteTrip, unlinkShared, closeModal } = useTicketHandler(
        tripKey!,
        {
            onSuccess: (message) => showToast(message),
            onError: (message) => showToast(message),
        },
    );
    const { isPlaneFlying, openTrip } = useTicketNavigation(tripKey!);
    const { stubRef, play: playStubCurl } = useStubCurl();

    const { data: imagesResult } = useTripImages(tripKey ?? '');
    const mediaFiles = imagesResult?.success ? imagesResult.data : undefined;
    const coverPhoto = isCompletedTrip ? mediaFiles?.[0]?.mediaLink : undefined;
    const photoCountLabel = mediaFiles !== undefined ? `${mediaFiles.length}장` : '—';

    if (isCompletedTrip === undefined) return null;

    const isOwner = userInfo?.nickname === ownerNickname;
    const ticketView = getTicketView({ tripTitle, country, startDate, endDate }, { completed: !!isCompletedTrip });
    const sharedPeople = [ownerNickname || '', ...(sharedUsersNicknames || [])];
    const removeConfirmCopy = isOwner ? REMOVE_CONFIRM_COPY.owner : REMOVE_CONFIRM_COPY.shared;

    const sharedBadge = !isOwner && <span css={sharedBadgeStyle}>공유받은 티켓</span>;
    const openActionSheet = () => setIsActionSheetOpen(true);

    return (
        <div css={containerStyle}>
            {isDeleting && <Indicator text='여행 티켓 삭제 중...' />}
            {isUnLinking && <Indicator text='공유 티켓 삭제 중...' />}

            {!isCompletedTrip && (
                <DraftTicketOverlay
                    onContinue={() => handler.edit(isCompletedTrip)}
                    onDelete={() => requireMember('delete', handler.delete)}
                />
            )}

            {ticketView.isDayTrip ? (
                <div
                    onClick={() => openTrip({ playExitEffect: playStubCurl })}
                    css={[clickableStyle, noTapHighlightStyle]}
                >
                    <DayPassTicket
                        stubRef={stubRef}
                        title={tripTitle}
                        dateLine={ticketView.dateLine}
                        placeEn={ticketView.placeEn}
                        hashtags={hashtags}
                        photoUrl={coverPhoto}
                        photoAlt={tripTitle}
                        fallbackBg={ticketView.fallbackBg}
                        height={DAY_PASS_HEIGHT.ticketList}
                        badge={sharedBadge}
                        action={<TicketMoreButton placement='photo' onClick={openActionSheet} />}
                    />
                </div>
            ) : (
                <div onClick={() => openTrip()} css={clickableStyle}>
                    <BoardingPassTicket
                        title={tripTitle}
                        dateLine={ticketView.dateLine || `${ticketView.startText} — ${ticketView.endText}`}
                        from={ticketView.from}
                        to={ticketView.to}
                        passenger={ownerNickname || '—'}
                        duration={ticketView.duration}
                        photoCountLabel={photoCountLabel}
                        hashtags={hashtags}
                        photoUrl={coverPhoto}
                        fallbackBg={ticketView.fallbackBg}
                        badge={sharedBadge}
                        action={<TicketMoreButton placement='band' onClick={openActionSheet} />}
                        isPlaneFlying={isPlaneFlying}
                    />
                </div>
            )}

            <TripTicketActionSheet
                open={isActionSheetOpen}
                onClose={() => setIsActionSheetOpen(false)}
                trip={{ tripTitle, country, coverPhoto, startDate, endDate }}
                isOwner={isOwner}
                isGuest={isGuest}
                isCompletedTrip={!!isCompletedTrip}
                handler={handler}
                onShare={() => setIsShareModalOpen(true)}
                onLocked={openLoginPrompt}
            />

            {isModalOpen && (
                <ConfirmModal
                    title={removeConfirmCopy.title}
                    description={removeConfirmCopy.description}
                    confirmText={removeConfirmCopy.confirmText}
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
                    dateLine={ticketView.dateLine}
                    onClose={() => setIsShareModalOpen(false)}
                />
            )}
        </div>
    );
};

// 티켓 모양·그림자는 안쪽 카드가 가진다 — 여기에 mask·filter를 걸면 안의 fixed 요소(Indicator·모달)까지 잘린다
const containerStyle = css`
    width: 100%;
    margin-bottom: 8px;
    position: relative;
    user-select: none;
`;

const clickableStyle = css`
    cursor: pointer;
`;

// 안드로이드 기본 탭 하이라이트가 말림 효과 위에 파란 사각형으로 덮이지 않게
const noTapHighlightStyle = css`
    -webkit-tap-highlight-color: transparent;
`;

const sharedBadgeStyle = css`
    font-size: 10px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    background: rgba(255, 255, 255, 0.15);
    border-radius: 100px;
    padding: 3px 8px;
    backdrop-filter: blur(8px);
`;

export default TripTicket;
