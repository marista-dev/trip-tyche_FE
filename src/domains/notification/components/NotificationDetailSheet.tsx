import NoticeBackupSheet from '@/domains/notification/components/sheets/NoticeBackupSheet';
import NoticeFeatureSheet from '@/domains/notification/components/sheets/NoticeFeatureSheet';
import NoticeIncompleteSheet from '@/domains/notification/components/sheets/NoticeIncompleteSheet';
import ShareRequestSheet from '@/domains/notification/components/sheets/ShareRequestSheet';
import ShareResultSheet from '@/domains/notification/components/sheets/ShareResultSheet';
import { Notification } from '@/domains/notification/types';
import BottomSheet from '@/shared/components/common/BottomSheet';

interface NotificationDetailSheetProps {
    notification: Notification | null;
    onClose: () => void;
    onAccept: (n: Notification) => void;
    onReject: (n: Notification) => void;
    onRemove: (n: Notification) => void;
    onCtaPrimary: (n: Notification) => void;
}

const NotificationDetailSheet = ({
    notification,
    onClose,
    onAccept,
    onReject,
    onRemove,
    onCtaPrimary,
}: NotificationDetailSheetProps) => {
    const isOpen = notification !== null;

    const renderContent = () => {
        if (!notification) return null;

        switch (notification.message) {
            case 'SHARED_REQUEST':
                return (
                    <ShareRequestSheet
                        notification={notification}
                        onAccept={() => onAccept(notification)}
                        onReject={() => onReject(notification)}
                    />
                );
            case 'SHARED_APPROVE':
                return (
                    <ShareResultSheet
                        notification={notification}
                        onPrimary={() => onCtaPrimary(notification)}
                        onRemove={() => onRemove(notification)}
                    />
                );
            case 'SHARED_REJECTED':
                return (
                    <ShareResultSheet
                        notification={notification}
                        onPrimary={onClose}
                        onRemove={() => onRemove(notification)}
                    />
                );
            case 'NOTICE_INCOMPLETE':
                return (
                    <NoticeIncompleteSheet
                        notification={notification}
                        onPrimary={() => onCtaPrimary(notification)}
                        onSecondary={onClose}
                    />
                );
            case 'NOTICE_FEATURE':
                return <NoticeFeatureSheet notification={notification} onPrimary={() => onCtaPrimary(notification)} />;
            case 'NOTICE_BACKUP':
                return <NoticeBackupSheet notification={notification} onPrimary={onClose} />;
            default:
                return null;
        }
    };

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose}>
            {renderContent()}
        </BottomSheet>
    );
};

export default NotificationDetailSheet;
