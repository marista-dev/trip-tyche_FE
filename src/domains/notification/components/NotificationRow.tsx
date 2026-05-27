import { css } from '@emotion/react';
import { Check } from 'lucide-react';

import {
    buildNotificationBody,
    FALLBACK_NOTIFICATION_ICON,
    NOTIFICATION_ICON,
    NOTIFICATION_TITLE,
} from '@/domains/notification/constants';
import { Notification } from '@/domains/notification/types';
import { formatKoreanTime } from '@/libs/utils/date';

interface NotificationRowProps {
    notification: Notification;
    onClick: () => void;
    onAccept?: () => void;
    onReject?: () => void;
    onCtaClick?: () => void;
    selectMode?: boolean;
    selected?: boolean;
}

const CTA_LABEL: Partial<Record<Notification['message'], string>> = {
    NOTICE_INCOMPLETE: '사진 관리로 →',
    NOTICE_FEATURE: '자세히 →',
    NOTICE_BACKUP: '내역 보기 →',
};

const NotificationRow = ({
    notification,
    onClick,
    onAccept,
    onReject,
    onCtaClick,
    selectMode = false,
    selected = false,
}: NotificationRowProps) => {
    const { message, status, senderNickname, createdAt } = notification;
    const isUnread = status === 'UNREAD';
    const Icon = NOTIFICATION_ICON[message] ?? FALLBACK_NOTIFICATION_ICON;
    const title = NOTIFICATION_TITLE[message] ?? '새로운 알림';
    const body = buildNotificationBody(message, senderNickname) || `${senderNickname}님이 알림을 보냈어요`;
    const isShareRequest = message === 'SHARED_REQUEST';
    const isNotice = message === 'NOTICE_INCOMPLETE' || message === 'NOTICE_FEATURE' || message === 'NOTICE_BACKUP';
    const showActions = !selectMode && isShareRequest && isUnread && onAccept && onReject;
    const showCta = !selectMode && isNotice && !!onCtaClick;
    const ctaLabel = CTA_LABEL[message];

    return (
        <div css={rootStyle(isUnread, selectMode, selected)} onClick={onClick}>
            {selectMode && (
                <div css={checkbox(selected)} aria-label={selected ? '선택 해제' : '선택'}>
                    {selected && <Check size={14} strokeWidth={3} />}
                </div>
            )}

            <div css={iconCircle(isUnread)}>
                <Icon size={18} strokeWidth={2} />
            </div>

            <div css={contentCol}>
                <div css={topRow}>
                    <h3 css={titleStyle(isUnread)}>{title}</h3>
                    <span css={timeStyle}>{formatKoreanTime(createdAt)}</span>
                </div>

                <p css={bodyStyle(isUnread)}>{body}</p>

                {showActions && (
                    <div css={actionsRow}>
                        <button
                            type='button'
                            css={acceptBtn}
                            onClick={(e) => {
                                e.stopPropagation();
                                onAccept();
                            }}
                        >
                            수락
                        </button>
                        <button
                            type='button'
                            css={rejectBtn}
                            onClick={(e) => {
                                e.stopPropagation();
                                onReject();
                            }}
                        >
                            거절
                        </button>
                    </div>
                )}

                {!showActions && showCta && ctaLabel && (
                    <button
                        type='button'
                        css={ctaBtn}
                        onClick={(e) => {
                            e.stopPropagation();
                            onCtaClick();
                        }}
                    >
                        {ctaLabel}
                    </button>
                )}
            </div>

            {!selectMode && isUnread && <span css={unreadDot} />}
        </div>
    );
};

const rootStyle = (isUnread: boolean, selectMode: boolean, selected: boolean) => css`
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 20px;
    cursor: pointer;
    position: relative;
    border-bottom: 1px solid rgba(0, 0, 0, 0.04);
    background: ${selectMode && selected
        ? 'rgba(0, 113, 227, 0.08)'
        : isUnread
          ? 'rgba(0, 113, 227, 0.04)'
          : 'transparent'};
    transition: background 200ms;
    -webkit-tap-highlight-color: transparent;
    &:active {
        background: rgba(0, 0, 0, 0.03);
    }
`;

const checkbox = (selected: boolean) => css`
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    margin-top: 9px;
    border-radius: 50%;
    border: 1.5px solid ${selected ? '#0071e3' : 'rgba(0, 0, 0, 0.2)'};
    background: ${selected ? '#0071e3' : 'transparent'};
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
        background 150ms,
        border-color 150ms;
`;

const iconCircle = (isUnread: boolean) => css`
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${isUnread ? 'rgba(0, 113, 227, 0.10)' : '#f1f5f9'};
    color: ${isUnread ? '#0071e3' : '#94a3b8'};
`;

const contentCol = css`
    flex: 1;
    min-width: 0;
`;

const topRow = css`
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 3px;
`;

const titleStyle = (isUnread: boolean) => css`
    font-size: 14px;
    font-weight: ${isUnread ? 700 : 600};
    color: #1d1d1f;
    letter-spacing: -0.2px;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const timeStyle = css`
    font-size: 11px;
    color: #94a3b8;
    flex-shrink: 0;
`;

const bodyStyle = (isUnread: boolean) => css`
    font-size: 13px;
    color: ${isUnread ? '#475569' : '#94a3b8'};
    margin: 0;
    line-height: 1.5;
`;

const actionsRow = css`
    display: flex;
    gap: 6px;
    margin-top: 10px;
`;

const baseActionBtn = css`
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    border: none;
`;

const acceptBtn = css`
    ${baseActionBtn};
    background: #0071e3;
    color: #ffffff;
    border: none;
`;

const rejectBtn = css`
    ${baseActionBtn};
    background: #ffffff;
    color: #111111;
    border: 1px solid rgba(0, 0, 0, 0.12);
`;

const ctaBtn = css`
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-top: 8px;
    padding: 6px 12px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid rgba(0, 0, 0, 0.1);
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
`;

const unreadDot = css`
    position: absolute;
    top: 22px;
    right: 12px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #0071e3;
`;

export default NotificationRow;
