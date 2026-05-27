import { useEffect, useMemo, useState } from 'react';

import { css, keyframes } from '@emotion/react';
import { CheckSquare, Square, Trash2 } from 'lucide-react';
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
    const [editMode, setEditMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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
    const visibleIds = useMemo(() => items.map((n) => n.notificationId), [items]);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

    // 편집 모드 진입 시 / 탭 변경 시 선택 초기화
    useEffect(() => {
        setSelectedIds(new Set());
    }, [activeTab, editMode]);

    if (!result || !result.success) return null;

    const ensureRead = async (n: Notification) => {
        if (n.status === 'UNREAD') {
            const r = await markReadAsync(n.notificationId);
            if (!r.success) showToast(r.error);
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        setSelectedIds((prev) => (prev.size === visibleIds.length ? new Set() : new Set(visibleIds)));
    };

    const handleRowClick = async (n: Notification) => {
        if (editMode) {
            toggleSelect(n.notificationId);
            return;
        }
        await ensureRead(n);
        setActiveNotif(n);
    };

    // 처리된 SHARED_REQUEST 알림은 자동 삭제 — 더 이상 액션 의미 없음
    const removeProcessedRequest = (n: Notification) => {
        void deleteNotifAsync([n.notificationId]);
    };

    const handleInlineAccept = async (n: Notification) => {
        if (editMode) return;
        await ensureRead(n);
        const r = await updateShareStatusAsync({ shareId: n.referenceId, status: 'APPROVED' });
        if (r.success) {
            showToast(`${n.senderNickname}님의 여행에 참여했어요`);
            removeProcessedRequest(n);
            navigate(ROUTES.PATH.TICKETS);
        } else {
            showToast(r.error);
        }
    };

    const handleInlineReject = async (n: Notification) => {
        if (editMode) return;
        await ensureRead(n);
        const r = await updateShareStatusAsync({ shareId: n.referenceId, status: 'REJECTED' });
        if (r.success) {
            showToast('초대를 거절했어요');
            removeProcessedRequest(n);
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
        if (n.message === 'SHARED_APPROVE') {
            navigate(ROUTES.PATH.TICKETS);
            return;
        }
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

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        const r = await deleteNotifAsync(ids);
        if (r.success) {
            showToast(`${ids.length}개의 알림을 삭제했어요`);
            setEditMode(false);
            setSelectedIds(new Set());
        } else {
            showToast(r.error);
        }
    };

    const hasItems = items.length > 0;
    const canEdit = notifications.length > 0;
    const selectedCount = selectedIds.size;

    return (
        <div css={page}>
            <Header
                title={editMode ? `${selectedCount}개 선택됨` : '알림'}
                isBackButton={!editMode}
                onBack={() => navigate(ROUTES.PATH.TICKETS)}
            >
                {editMode ? (
                    <button type='button' css={textActionBtn} onClick={() => setEditMode(false)}>
                        취소
                    </button>
                ) : (
                    <div css={headerActions}>
                        <button
                            type='button'
                            css={markAllButton(unreadCount === 0)}
                            onClick={handleMarkAllRead}
                            disabled={unreadCount === 0}
                        >
                            {unreadCount > 0 ? `모두 읽음 (${unreadCount})` : '모두 읽음'}
                        </button>
                        <button
                            type='button'
                            css={textActionBtn}
                            onClick={() => setEditMode(true)}
                            disabled={!canEdit}
                            aria-label='편집'
                        >
                            편집
                        </button>
                    </div>
                )}
            </Header>

            {editMode ? (
                <div css={editSubBar}>
                    <button type='button' css={selectAllBtn} onClick={toggleSelectAll} disabled={!hasItems}>
                        {allSelected ? <CheckSquare size={16} strokeWidth={2} /> : <Square size={16} strokeWidth={2} />}
                        <span>{allSelected ? '전체 선택 해제' : '전체 선택'}</span>
                    </button>
                </div>
            ) : (
                <TabNavigation tabs={NOTIFICATION_TABS} activeTab={activeTab} onActiveChange={setActiveTab} />
            )}

            {isLoading ? (
                <Indicator text='알림 불러오는 중...' />
            ) : (
                <div css={content(editMode)}>
                    {hasItems ? (
                        items.map((n, i) => (
                            <div key={n.notificationId} css={itemWrap(i)}>
                                <NotificationRow
                                    notification={n}
                                    onClick={() => handleRowClick(n)}
                                    onAccept={() => handleInlineAccept(n)}
                                    onReject={() => handleInlineReject(n)}
                                    onCtaClick={() => handleRowClick(n)}
                                    selectMode={editMode}
                                    selected={selectedIds.has(n.notificationId)}
                                />
                            </div>
                        ))
                    ) : (
                        <EmptyNotification />
                    )}
                </div>
            )}

            {editMode && (
                <div css={bottomBar}>
                    <button
                        type='button'
                        css={deleteBtn(selectedCount === 0)}
                        onClick={handleBulkDelete}
                        disabled={selectedCount === 0}
                    >
                        <Trash2 size={16} strokeWidth={2} />
                        <span>{selectedCount > 0 ? `선택 삭제 (${selectedCount})` : '삭제할 항목 선택'}</span>
                    </button>
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
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #ffffff;
    position: relative;
`;

const content = (editMode: boolean) => css`
    flex: 1;
    overflow-y: auto;
    padding-bottom: ${editMode ? '80px' : '0'};
`;

const itemWrap = (i: number) => css`
    animation: ${itemEnter} 0.45s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.05}s both;
`;

const headerActions = css`
    display: flex;
    align-items: center;
    gap: 4px;
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

const textActionBtn = css`
    padding: 6px 12px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: #0071e3;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    -webkit-tap-highlight-color: transparent;
    transition: opacity 0.15s;
    &:disabled {
        color: #cbd5e1;
        cursor: default;
    }
    &:active:not(:disabled) {
        opacity: 0.6;
    }
`;

const editSubBar = css`
    padding: 10px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    background: #f8fafc;
`;

const selectAllBtn = css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 4px;
    background: transparent;
    border: none;
    color: #0071e3;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    &:disabled {
        color: #cbd5e1;
        cursor: default;
    }
    &:active:not(:disabled) {
        opacity: 0.6;
    }
`;

const bottomBar = css`
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid rgba(0, 0, 0, 0.06);
    z-index: 20;
`;

const deleteBtn = (disabled: boolean) => css`
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 0;
    border-radius: 12px;
    border: none;
    background: ${disabled ? 'rgba(220, 38, 38, 0.08)' : '#dc2626'};
    color: ${disabled ? '#dc2626' : '#fff'};
    font-size: 14px;
    font-weight: 700;
    font-family: inherit;
    cursor: ${disabled ? 'default' : 'pointer'};
    opacity: ${disabled ? 0.55 : 1};
    box-shadow: ${disabled ? 'none' : '0 6px 16px rgba(220, 38, 38, 0.3)'};
    -webkit-tap-highlight-color: transparent;
    transition:
        opacity 0.15s,
        background 0.15s;
    &:active:not(:disabled) {
        opacity: 0.85;
    }
`;
