import { css } from '@emotion/react';
import { Plane } from 'lucide-react';

import { buttonRow, outlineButton, sheetSubtitle, sheetTitle } from './styles';
import { Notification } from '@/domains/notification/types';

interface ShareRequestSheetProps {
    notification: Notification;
    onAccept: () => void;
    onReject: () => void;
    onRemove?: () => void;
}

const ShareRequestSheet: React.FC<ShareRequestSheetProps> = ({ notification, onAccept, onReject, onRemove }) => {
    const { senderNickname } = notification;

    return (
        <div>
            <h2 css={sheetTitle}>여행 티켓 공유 요청</h2>
            <p css={sheetSubtitle}>{senderNickname}님이 여행을 함께하기 위해 초대했어요</p>

            {/* TODO: 백엔드에서 trip title/dates/route 전달 시 채우기 */}
            <div css={boardingCard}>
                <div css={boardingLabel}>TYCHE AIR · BOARDING</div>
                <div css={tripTitle}>여행 티켓</div>
                <div css={tripDate}>공유받은 여행</div>
                <div css={routeRow}>
                    <span css={airportCode}>ICN</span>
                    <div css={dashedLine} />
                    <Plane size={13} color='#fff' fill='#fff' />
                    <div css={dashedLine} />
                    <span css={airportCode}>KIX</span>
                </div>
            </div>

            <div css={buttonRow}>
                <button type='button' css={outlineButton} onClick={onReject}>
                    거절
                </button>
                <button type='button' css={joinButton} onClick={onAccept}>
                    여행에 참여하기
                </button>
            </div>

            {onRemove && (
                <button type='button' css={removeButton} onClick={onRemove}>
                    알림 삭제
                </button>
            )}
        </div>
    );
};

const boardingCard = css`
    background: #0f172a;
    border-radius: 14px;
    padding: 16px;
    color: #fff;
    margin-bottom: 16px;
`;

const boardingLabel = css`
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 6px;
`;

const tripTitle = css`
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.3px;
`;

const tripDate = css`
    font-size: 11px;
    color: rgba(255, 255, 255, 0.65);
    margin-top: 4px;
`;

const routeRow = css`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
`;

const airportCode = css`
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.04em;
`;

const dashedLine = css`
    flex: 1;
    height: 1px;
    background: repeating-linear-gradient(to right, rgba(255, 255, 255, 0.4) 0 3px, transparent 3px 7px);
`;

const joinButton = css`
    flex: 2;
    padding: 12px 0;
    border-radius: 12px;
    background: #0071e3;
    border: none;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    box-shadow: 0 6px 16px rgba(0, 113, 227, 0.4);
`;

const removeButton = css`
    display: block;
    width: 100%;
    margin-top: 12px;
    padding: 10px 0;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    &:active {
        opacity: 0.6;
    }
`;

export default ShareRequestSheet;
