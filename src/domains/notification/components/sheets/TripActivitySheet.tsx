import { css } from '@emotion/react';

import { buildNotificationBody, NOTIFICATION_ICON, NOTIFICATION_TITLE } from '@/domains/notification/constants';
import { useNotificationDetail } from '@/domains/notification/hooks/queries';
import { Notification } from '@/domains/notification/types';

interface TripActivitySheetProps {
    notification: Notification;
    onPrimary: () => void;
    onRemove: () => void;
}

const TripActivitySheet: React.FC<TripActivitySheetProps> = ({ notification, onPrimary, onRemove }) => {
    const { message, senderNickname, notificationId } = notification;
    const { data: detailResult } = useNotificationDetail(notificationId);
    const Icon = NOTIFICATION_ICON[message];
    const title = NOTIFICATION_TITLE[message] ?? '새로운 알림';
    const baseBody = buildNotificationBody(message, senderNickname) || `${senderNickname}님이 알림을 보냈어요`;

    const tripTitle = detailResult?.success ? detailResult.data?.tripTitle : undefined;
    const body = tripTitle ? `${senderNickname}님이 "${tripTitle}" ${tail(message)}` : baseBody;

    return (
        <div css={wrapper}>
            <div css={iconCircle}>
                <Icon size={26} strokeWidth={2} />
            </div>
            <h2 css={titleStyle}>{title}</h2>
            <p css={bodyStyle}>{body}</p>
            <button type='button' css={primaryBtn} onClick={onPrimary}>
                확인
            </button>
            <button type='button' css={ghostBtn} onClick={onRemove}>
                알림 삭제
            </button>
        </div>
    );
};

const tail = (message: Notification['message']): string => {
    switch (message) {
        case 'TRIP_UPDATED':
            return '여행 정보를 수정했어요';
        case 'TRIP_DELETED':
            return '여행을 삭제했어요';
        case 'MEDIA_FILE_ADDED':
            return '여행에 사진을 추가했어요';
        case 'MEDIA_FILE_UPDATED':
            return '여행의 사진을 수정했어요';
        case 'MEDIA_FILE_DELETED':
            return '여행의 사진을 삭제했어요';
        default:
            return '에 새로운 활동이 있어요';
    }
};

const wrapper = css`
    text-align: center;
    padding: 12px 0;
`;

const iconCircle = css`
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #f1f5f9;
    color: #64748b;
    display: grid;
    place-items: center;
    margin: 0 auto 14px;
`;

const titleStyle = css`
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #111111;
    letter-spacing: -0.3px;
`;

const bodyStyle = css`
    margin: 6px 0 22px;
    font-size: 13px;
    color: #666666;
    line-height: 1.5;
`;

const primaryBtn = css`
    width: 100%;
    padding: 12px 0;
    border-radius: 12px;
    background: #0071e3;
    border: none;
    color: #ffffff;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
`;

const ghostBtn = css`
    margin-top: 8px;
    width: 100%;
    padding: 10px 0;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
`;

export default TripActivitySheet;
