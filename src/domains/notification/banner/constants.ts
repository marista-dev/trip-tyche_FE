import { CheckCircle2, ImageMinus, ImagePlus, LucideIcon, PenLine, Trash2, UserPlus, XCircle } from 'lucide-react';

import { BannerMessage, BannerType } from './types';
import { COLORS } from '@/shared/constants/style';

export const BANNER_ICON: Record<BannerType, LucideIcon> = {
    SHARED_REQUEST: UserPlus,
    SHARED_APPROVE: CheckCircle2,
    SHARED_REJECTED: XCircle,
    TRIP_UPDATED: PenLine,
    TRIP_DELETED: Trash2,
    MEDIA_FILE_ADDED: ImagePlus,
    MEDIA_FILE_UPDATED: PenLine,
    MEDIA_FILE_DELETED: ImageMinus,
};

export const BANNER_TITLE: Record<BannerType, string> = {
    SHARED_REQUEST: '여행 초대',
    SHARED_APPROVE: '메이트 등록',
    SHARED_REJECTED: '공유 요청 거절',
    TRIP_UPDATED: '여행 정보 수정',
    TRIP_DELETED: '여행 삭제',
    MEDIA_FILE_ADDED: '사진 추가',
    MEDIA_FILE_UPDATED: '사진 수정',
    MEDIA_FILE_DELETED: '사진 삭제',
};

export const buildBannerBody = (msg: BannerMessage): string => {
    const sender = msg.senderNickname || '친구';
    const trip = msg.tripTitle ? `"${msg.tripTitle}"` : '';
    const n = msg.count && msg.count > 0 ? `${msg.count}장의 ` : '';
    switch (msg.type) {
        case 'SHARED_REQUEST':
            return trip ? `${sender}님이 ${trip}에 초대했어요` : `${sender}님이 여행에 초대했어요`;
        case 'SHARED_APPROVE':
            return trip ? `${sender}님과 ${trip} 메이트가 됐어요` : `${sender}님과 여행 메이트가 됐어요`;
        case 'SHARED_REJECTED':
            return `${sender}님이 공유 요청을 거절했어요`;
        case 'TRIP_UPDATED':
            return trip ? `${sender}님이 ${trip}을 수정했어요` : `${sender}님이 여행을 수정했어요`;
        case 'TRIP_DELETED':
            return trip ? `${sender}님이 ${trip}을 삭제했어요` : `${sender}님이 공유한 여행을 삭제했어요`;
        case 'MEDIA_FILE_ADDED':
            return `${sender}님이 ${n}사진을 추가했어요`;
        case 'MEDIA_FILE_UPDATED':
            return `${sender}님이 ${n}사진 정보를 수정했어요`;
        case 'MEDIA_FILE_DELETED':
            return `${sender}님이 ${n}사진을 삭제했어요`;
    }
};

export const BANNER_DESIGN = {
    radius: 22,
    z: 1020,
    icon: {
        size: 40,
        background: 'rgba(0,113,227,0.10)',
        color: COLORS.PRIMARY,
        svgSize: 18,
    },
    surface: {
        background: 'rgba(255,255,255,0.85)',
        backgroundFallback: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(28px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.5)',
        boxShadow: '0 12px 30px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
    },
    text: {
        title: { size: 14, weight: 700, color: '#111', letterSpacing: -0.2 },
        body: { size: 12, color: '#555', lineHeight: 1.4 },
        time: { size: 11, weight: 600, color: COLORS.PRIMARY },
    },
    boarding: { background: '#0f172a', radius: 14, padding: 16 },
    actions: {
        reject: { bg: 'rgba(0,0,0,0.04)', color: '#111' },
        accept: { bg: COLORS.PRIMARY, color: '#fff', shadow: '0 6px 16px rgba(0,113,227,0.35)' },
    },
    timing: { autoDismissMs: 4000, swipeThresholdPx: 40 },
} as const;
