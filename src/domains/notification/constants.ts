import {
    Bell,
    CheckCircle2,
    CloudUpload,
    ImageMinus,
    ImagePlus,
    LucideIcon,
    MapPin,
    PenLine,
    Sparkles,
    Trash2,
    UserPlus,
    XCircle,
} from 'lucide-react';

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
    TRIP_UPDATED: PenLine,
    TRIP_DELETED: Trash2,
    MEDIA_FILE_ADDED: ImagePlus,
    MEDIA_FILE_UPDATED: PenLine,
    MEDIA_FILE_DELETED: ImageMinus,
    NOTICE_INCOMPLETE: MapPin,
    NOTICE_FEATURE: Sparkles,
    NOTICE_BACKUP: CloudUpload,
};

export const FALLBACK_NOTIFICATION_ICON: LucideIcon = Bell;

export const NOTIFICATION_TITLE: Record<NotificationMessage, string> = {
    SHARED_REQUEST: '친구가 여행에 초대했어요',
    SHARED_APPROVE: '여행 초대가 수락됐어요',
    SHARED_REJECTED: '여행 초대가 거절됐어요',
    TRIP_UPDATED: '여행 정보가 수정됐어요',
    TRIP_DELETED: '공유한 여행이 삭제됐어요',
    MEDIA_FILE_ADDED: '여행에 사진이 추가됐어요',
    MEDIA_FILE_UPDATED: '여행의 사진이 수정됐어요',
    MEDIA_FILE_DELETED: '여행의 사진이 삭제됐어요',
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
        case 'TRIP_UPDATED':
            return `${sender}님이 여행 정보를 수정했어요`;
        case 'TRIP_DELETED':
            return `${sender}님이 공유한 여행을 삭제했어요`;
        case 'MEDIA_FILE_ADDED':
            return `${sender}님이 여행에 사진을 추가했어요`;
        case 'MEDIA_FILE_UPDATED':
            return `${sender}님이 여행의 사진을 수정했어요`;
        case 'MEDIA_FILE_DELETED':
            return `${sender}님이 여행의 사진을 삭제했어요`;
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
