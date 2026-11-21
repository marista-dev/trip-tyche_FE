import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

import BannerCard from './BannerCard';
import { BannerMessage } from './types';
import { useBannerStore } from './useBannerStore';
import { notificationKeys } from '@/domains/notification/queryKeys';
import { useShareStatus } from '@/domains/share/hooks/mutations';
import { SUMMARY_QUERY_KEY } from '@/domains/user/queryKeys';
import { ROUTES } from '@/shared/constants/route';
import { queryClient } from '@/shared/providers/TanStackProvider';
import { useToastStore } from '@/shared/stores/useToastStore';

const WebSocketBanner: React.FC = () => {
    const current = useBannerStore((s) => s.current);
    const expanded = useBannerStore((s) => s.expanded);
    const pending = useBannerStore((s) => s.pending);
    const expand = useBannerStore((s) => s.expand);
    const collapse = useBannerStore((s) => s.collapse);
    const dismiss = useBannerStore((s) => s.dismiss);
    const setPending = useBannerStore((s) => s.setPending);

    const navigate = useNavigate();
    const showToast = useToastStore((s) => s.showToast);
    const { mutateAsync: updateShareStatus } = useShareStatus();

    if (!current) return null;

    const navigateForType = (msg: BannerMessage) => {
        switch (msg.type) {
            case 'SHARED_APPROVE':
                if (msg.tripKey) navigate(ROUTES.PATH.TRIP.ROOT(msg.tripKey));
                else navigate(ROUTES.PATH.TICKETS);
                return;
            case 'TRIP_UPDATED':
            case 'MEDIA_FILE_ADDED':
            case 'MEDIA_FILE_UPDATED':
                if (msg.tripKey) navigate(ROUTES.PATH.TRIP.ROOT(msg.tripKey));
                return;
            default:
                return;
        }
    };

    const handleTap = () => {
        if (pending) return;
        if (current.type === 'SHARED_REQUEST') {
            expand();
            return;
        }
        navigateForType(current);
        dismiss();
    };

    // 공유·여행 목록은 useShareStatus가 갱신한다. 배너에서 처리한 초대는 알림·요약 수에도 반영해야 한다.
    const invalidateAfterShareAction = () => {
        queryClient.invalidateQueries({ queryKey: SUMMARY_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    };

    const runShareMutation = async (status: 'APPROVED' | 'REJECTED', successMsg: string) => {
        if (!current.shareId || pending) return;
        setPending(true);
        try {
            const result = await updateShareStatus({ shareId: current.shareId, status });
            if (result.success) {
                showToast(successMsg);
                invalidateAfterShareAction();
                collapse();
                dismiss();
            } else {
                showToast(result.error || '초대 처리 중 문제가 발생했어요');
                setPending(false);
            }
        } catch {
            showToast('초대 처리 중 문제가 발생했어요');
            setPending(false);
        }
    };

    const handleAccept = () => {
        if (!current.shareId) {
            // shareId 없으면 fallback: 알림 페이지로 이동
            navigate(ROUTES.PATH.TICKETS);
            dismiss();
            return;
        }
        void runShareMutation('APPROVED', '여행에 참여했어요 🎉');
    };

    const handleReject = () => {
        if (!current.shareId) {
            dismiss();
            return;
        }
        void runShareMutation('REJECTED', '초대를 거절했어요');
    };

    return (
        <AnimatePresence mode='wait'>
            <BannerCard
                key={current.id}
                message={current}
                expanded={expanded}
                pending={pending}
                onTap={handleTap}
                onDismiss={dismiss}
                onAccept={handleAccept}
                onReject={handleReject}
            />
        </AnimatePresence>
    );
};

export default WebSocketBanner;
