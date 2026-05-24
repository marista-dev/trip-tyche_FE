import { CheckCircle2, CloudUpload, LucideIcon, MapPin, Sparkles, UserPlus, XCircle } from 'lucide-react';

import { NotificationMessage } from '@/domains/notification/types';
import { TabItem } from '@/shared/types';

export const NOTIFICATION_TABS: TabItem[] = [
    { id: 'all', title: '전체' },
    { id: 'notice', title: '안내' },
];

export const NOTIFICATION_ICON: Record<NotificationMessage, LucideIcon> = {
    SHARED_REQUEST: UserPlus,
    SHARED_APPROVE: CheckCircle2,
    SHARED_REJECTED: XCircle,
    NOTICE_INCOMPLETE: MapPin,
    NOTICE_FEATURE: Sparkles,
    NOTICE_BACKUP: CloudUpload,
};

export const NOTIFICATION_TITLE: Record<NotificationMessage, string> = {
    SHARED_REQUEST: '친구가 여행에 초대했어요',
    SHARED_APPROVE: '여행 초대가 수락됐어요',
    SHARED_REJECTED: '여행 초대가 거절됐어요',
    NOTICE_INCOMPLETE: '사진 정리가 필요해요',
    NOTICE_FEATURE: '새 기능이 추가됐어요',
    NOTICE_BACKUP: '여행이 백업됐어요',
};

export const buildNotificationBody = (message: NotificationMessage, sender: string): string => {
    switch (message) {
        case 'SHARED_REQUEST':
            return `${sender}님이 여행 티켓을 공유했습니다`;
        case 'SHARED_APPROVE':
            return `${sender}님이 여행 초대를 수락했습니다`;
        case 'SHARED_REJECTED':
            return `${sender}님이 여행 초대를 거절했습니다`;
        case 'NOTICE_INCOMPLETE':
            return '위치 정보가 없는 사진이 있어요';
        case 'NOTICE_FEATURE':
            return '비슷한 시간/위치 사진으로 메타데이터를 자동 추정해보세요';
        case 'NOTICE_BACKUP':
            return '여행 사진과 경로가 안전하게 저장됐어요';
        default:
            return '';
    }
};
