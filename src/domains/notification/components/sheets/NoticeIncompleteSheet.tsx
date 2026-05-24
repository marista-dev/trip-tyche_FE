import { css } from '@emotion/react';
import { AlertCircle } from 'lucide-react';

import { accentButton, buttonRow, outlineButton, sheetSubtitle, sheetTitle } from './styles';
import { buildNotificationBody } from '@/domains/notification/constants';
import { Notification } from '@/domains/notification/types';

interface NoticeIncompleteSheetProps {
    notification: Notification;
    onPrimary: () => void;
    onSecondary: () => void;
}

const NoticeIncompleteSheet: React.FC<NoticeIncompleteSheetProps> = ({ notification, onPrimary, onSecondary }) => {
    const { message, senderNickname } = notification;

    return (
        <div>
            <h2 css={sheetTitle}>사진 정리가 필요해요</h2>
            <p css={sheetSubtitle}>{buildNotificationBody(message, senderNickname)}</p>

            <div css={amberCard}>
                <div css={amberIcon}>
                    <AlertCircle size={16} />
                </div>
                <div>
                    <div css={amberCardTitle}>위치 정보 누락</div>
                    <div css={amberCardSub}>사진 관리 화면에서 확인</div>
                </div>
            </div>

            <div css={buttonRow}>
                <button type='button' css={outlineButton} onClick={onSecondary}>
                    나중에
                </button>
                <button type='button' css={accentButton} onClick={onPrimary}>
                    사진 관리로 이동 →
                </button>
            </div>
        </div>
    );
};

const amberCard = css`
    background: #fef3c7;
    border-radius: 12px;
    padding: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
`;

const amberIcon = css`
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: #fef9c3;
    color: #d97706;
    display: grid;
    place-items: center;
    flex-shrink: 0;
`;

const amberCardTitle = css`
    font-size: 12px;
    font-weight: 700;
    color: #92400e;
`;

const amberCardSub = css`
    font-size: 11px;
    color: #a16207;
    margin-top: 1px;
`;

export default NoticeIncompleteSheet;
