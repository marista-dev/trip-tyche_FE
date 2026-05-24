import { useEffect, useMemo, useState } from 'react';

import { css, keyframes } from '@emotion/react';
import { useNavigate, useParams } from 'react-router-dom';

import EmptyNotification from '@/domains/notification/components/EmptyNotification';
import NotificationDetailSheet from '@/domains/notification/components/NotificationDetailSheet';
import NotificationRow from '@/domains/notification/components/NotificationRow';
import { NOTIFICATION_TABS } from '@/domains/notification/constants';
import { useNotificationDelete, useNotificationStatus } from '@/domains/notification/hooks/mutations';
import { useNotificationList } from '@/domains/notification/hooks/queries';
import { Notification, NOTIFICATION_KIND } from '@/domains/notification/types';
import { useShareStatus } from '@/domains/share/hooks/mutations';
import Header from '@/shared/components/common/Header';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import TabNavigation from '@/shared/components/common/Tab/TabNavigation';
import { ROUTES } from '@/shared/constants/route';
import { MESSAGE } from '@/shared/constants/ui';
import { useToastStore } from '@/shared/stores/useToastStore';

const NotificationPage = () => {
    const [activeTab, setActiveTab] = useState<string>(NOTIFICATION_TABS[0].id);
    const [activeNotif, setActiveNotif] = useState<Notification | null>(null);

    const showToast = useToastStore((state) => state.showToast);
    const navigate = useNavigate();
    const { userId } = useParams();

    const { data: result, isLoading } = useNotificationList(Number(userId));
    const { mutateAsync: markReadAsync } = useNotificationStatus();
    const { mutateAsync: deleteNotifAsync } = useNotificationDelete();
    const { mutateAsync: updateShareStatusAsync } = useShareStatus();

    useEffect(() => {
        if (result && !result.success) {
            navigate(ROUTES.PATH.TICKETS);
            showToast(result.error || MESSAGE.ERROR.UNKNOWN);
        }
    }, [result, navigate, showToast]);

    const notifications = useMemo<Notification[]>(() => {
        if (!result || !result.success) return [];
        return [...result.data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [result]);

    const items = useMemo(() => {
        if (activeTab === 'notice') {
            return notifications.filter((n) => NOTIFICATION_KIND[n.message] === 'notice');
        }
        return notifications;
    }, [activeTab, notifications]);

    const unreadCount = useMemo(() => notifications.filter((n) => n.status === 'UNREAD').length, [notifications]);

    if (!result || !result.success) return null;

    const ensureRead = async (n: Notification) => {
        if (n.status === 'UNREAD') {
            const r = await markReadAsync(n.notificationId);
            if (!r.success) showToast(r.error);
        }
    };

    const handleRowClick = async (n: Notification) => {
        await ensureRead(n);
        setActiveNotif(n);
    };

    const handleInlineAccept = async (n: Notification) => {
        await ensureRead(n);
        const r = await updateShareStatusAsync({ shareId: n.referenceId, status: 'APPROVE' });
        if (r.success) {
            showToast(`${n.senderNickname}님의 여행에 참여했어요`);
        } else {
            showToast(r.error);
        }
    };

    const handleInlineReject = async (n: Notification) => {
        await ensureRead(n);
        const r = await updateShareStatusAsync({ shareId: n.referenceId, status: 'REJECTED' });
        if (r.success) {
            showToast('초대를 거절했어요');
        } else {
            showToast(r.error);
        }
    };

    const handleSheetAccept = async (n: Notification) => {
        setActiveNotif(null);
        await handleInlineAccept(n);
    };

    const handleSheetReject = async (n: Notification) => {
        setActiveNotif(null);
        await handleInlineReject(n);
    };

    const handleSheetRemove = async (n: Notification) => {
        setActiveNotif(null);
        const r = await deleteNotifAsync([n.notificationId]);
        if (r.success) {
            showToast('알림을 삭제했어요');
        } else {
            showToast(r.error);
        }
    };

    const handleCtaPrimary = (n: Notification) => {
        setActiveNotif(null);
        // TODO: NOTICE_* payload 가 정의되면 타입별로 적절한 라우트 이동 처리
        if (n.message === 'NOTICE_INCOMPLETE') {
            showToast('사진 관리 진입점이 곧 제공돼요');
            return;
        }
        if (n.message === 'NOTICE_FEATURE') {
            showToast('새 기능 페이지 준비 중이에요');
            return;
        }
    };

    const handleMarkAllRead = async () => {
        if (unreadCount === 0) return;
        const targets = notifications.filter((n) => n.status === 'UNREAD');
        await Promise.allSettled(targets.map((n) => markReadAsync(n.notificationId)));
        showToast('모든 알림을 읽음 처리했어요');
    };

    const hasItems = items.length > 0;

    return (
        <div css={page}>
            <Header title='알림' isBackButton onBack={() => navigate(ROUTES.PATH.TICKETS)}>
                <button
                    type='button'
                    css={markAllButton(unreadCount === 0)}
                    onClick={handleMarkAllRead}
                    disabled={unreadCount === 0}
                >
                    {unreadCount > 0 ? `모두 읽음 (${unreadCount})` : '모두 읽음'}
                </button>
            </Header>

            <TabNavigation tabs={NOTIFICATION_TABS} activeTab={activeTab} onActiveChange={setActiveTab} />

            {isLoading ? (
                <Indicator text='알림 불러오는 중...' />
            ) : (
                <div css={content}>
                    {hasItems ? (
                        items.map((n, i) => (
                            <div key={n.notificationId} css={itemWrap(i)}>
                                <NotificationRow
                                    notification={n}
                                    onClick={() => handleRowClick(n)}
                                    onAccept={() => handleInlineAccept(n)}
                                    onReject={() => handleInlineReject(n)}
                                    onCtaClick={() => handleRowClick(n)}
                                />
                            </div>
                        ))
                    ) : (
                        <EmptyNotification />
                    )}
                </div>
            )}

            <NotificationDetailSheet
                notification={activeNotif}
                onClose={() => setActiveNotif(null)}
                onAccept={handleSheetAccept}
                onReject={handleSheetReject}
                onRemove={handleSheetRemove}
                onCtaPrimary={handleCtaPrimary}
            />
        </div>
    );
};

export default NotificationPage;

const itemEnter = keyframes`
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
`;

const page = css`
    height: 100%;
    overflow: auto;
    display: flex;
    flex-direction: column;
    background: #ffffff;
`;

const content = css`
    flex: 1;
    overflow-y: auto;
`;

const itemWrap = (i: number) => css`
    animation: ${itemEnter} 0.45s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.05}s both;
`;

const markAllButton = (disabled: boolean) => css`
    padding: 6px 12px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: ${disabled ? '#cbd5e1' : '#0071e3'};
    font-size: 13px;
    font-weight: 600;
    cursor: ${disabled ? 'default' : 'pointer'};
    font-family: inherit;
    -webkit-tap-highlight-color: transparent;
    &:active {
        opacity: ${disabled ? 1 : 0.6};
    }
`;
