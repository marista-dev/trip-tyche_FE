import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

import BannerCard from './BannerCard';
import { BannerMessage } from './types';
import { useBannerStore } from './useBannerStore';
import useUserStore from '@/domains/user/stores/useUserStore';
import { ROUTES } from '@/shared/constants/route';

const WebSocketBanner: React.FC = () => {
    const current = useBannerStore((s) => s.current);
    const expanded = useBannerStore((s) => s.expanded);
    const expand = useBannerStore((s) => s.expand);
    const dismiss = useBannerStore((s) => s.dismiss);
    const userId = useUserStore((s) => s.userInfo?.userId);
    const navigate = useNavigate();

    if (!current) return null;

    const goNotification = () => {
        if (userId) navigate(ROUTES.PATH.NOTIFICATION(userId));
    };

    const navigateForType = (msg: BannerMessage) => {
        switch (msg.type) {
            case 'SHARED_APPROVE':
                navigate(ROUTES.PATH.TICKETS);
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
        if (current.type === 'SHARED_REQUEST') {
            expand();
            return;
        }
        navigateForType(current);
        dismiss();
    };

    const handleAccept = () => {
        goNotification();
        dismiss();
    };

    const handleReject = () => {
        goNotification();
        dismiss();
    };

    return (
        <AnimatePresence mode='wait'>
            <BannerCard
                key={current.id}
                message={current}
                expanded={expanded}
                onTap={handleTap}
                onDismiss={dismiss}
                onAccept={handleAccept}
                onReject={handleReject}
            />
        </AnimatePresence>
    );
};

export default WebSocketBanner;
