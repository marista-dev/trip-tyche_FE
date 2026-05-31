import { COLORS } from '@/shared/constants/style';

export const MANAGE_TOKENS = {
    bg: '#fafafa',
    card: '#ffffff',
    accent: COLORS.PRIMARY,
    accentSoft: 'rgba(0,113,227,0.10)',
    destructive: '#dc2626',
    destructiveSoft: '#fef2f2',
    destructiveBorder: 'rgba(220,38,38,0.18)',
    warning: '#d97706',
    warningSoft: '#fef3c7',
    warningBorder: 'rgba(245,158,11,0.18)',
    success: '#16a34a',
    border: 'rgba(0,0,0,0.06)',
    borderStrong: 'rgba(0,0,0,0.08)',
    text: {
        primary: '#111111',
        secondary: '#555555',
        muted: '#888888',
        label: '#666666',
    },
    radius: {
        sharp: 0,
        soft: 6,
        pill: 12,
        large: 14,
    },
    font: "'Outfit', -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif",
} as const;
