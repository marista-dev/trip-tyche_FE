import { ThemeType } from '@/shared/types';

export const FONT_FAMILY =
    "'SF Pro Text', 'SF Pro Display', 'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const COLORS = {
    PRIMARY: '#0071e3',
    /** 지도/지구본 전용 액센트(sky-500). PRIMARY와 의도적으로 구분된 밝은 블루. */
    ACCENT: '#0ea5e9',
    SECONDARY: '#1d1d1f',
    TICKET_BAND: '#0f172a',
    PRIMARY_HOVER: '#0077ed',
    TEXT: {
        BLACK: '#0f172a',
        TITLE: '#1d1d1f',
        WHITE: '#ffffff',
        PLACEHOLDER: 'rgba(15, 23, 42, 0.35)',
        SUCCESS: '#059669',
        // 흰 바탕 4.5:1 이상(WCAG AA). #ef4444는 3.76이라 작은 경고 문구가 읽히지 않았다.
        ERROR: '#dc2626',
        // 보조 글자도 흰 바탕 4.5:1 이상. 예전 0.4/0.5는 2.6/3.4라 낮 야외에서 읽기 어려웠다.
        DESCRIPTION: 'rgba(15, 23, 42, 0.68)',
        DESCRIPTION_LIGHT: 'rgba(15, 23, 42, 0.62)',
        SECONDARY: 'rgba(15, 23, 42, 0.64)',
        LINK_LIGHT: '#0066cc',
        LINK_DARK: '#2997ff',
    },
    ICON: {
        DEFAULT: '#0f172a',
        LIGHT: 'rgba(15, 23, 42, 0.4)',
    },
    DISABLED: 'rgba(0, 0, 0, 0.16)',
    BACKGROUND: {
        PRIMARY: '#f8fafc',
        PRIMARY_LIGHT: 'rgba(0, 113, 227, 0.08)',
        BLACK: '#000000',
        WHITE: '#ffffff',
        WHITE_SECONDARY: '#f8fafc',
        GRAY: '#f1f5f9',
        GRAY_LIGHT: '#f8fafc',
        ICON: 'rgba(0, 0, 0, 0.08)',
        TOAST: 'rgba(0, 113, 227, 0.95)',
        ERROR_LIGHT: '#fff5f5',
        BODY: '#f8fafc',
        OVERLAY: 'rgba(0, 0, 0, 0.72)',
        OVERLAY_LIGHT: 'rgba(0, 0, 0, 0.32)',
        NAV: 'rgba(255, 255, 255, 0.92)',
        DARK_CARD: '#0055d4',
    },
    /** 입력칸 테두리 — 흰 바탕 3:1(WCAG 1.4.11). Mantine 기본 #ced4da는 1.5라 칸 경계가 흐렸다. */
    INPUT_BORDER: '#8b95a5',
    /** 중립 회색 단계(tailwind slate). 칩·구분선·보조 텍스트에 쓴다. */
    SLATE: {
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
    },
    /** 카드 안의 옅은 면(혜택 목록·기간 비교 등) */
    SURFACE_SUBTLE: 'rgba(15, 23, 42, 0.03)',
    SURFACE_SOFT: 'rgba(15, 23, 42, 0.05)',
    BORDER: 'rgba(0, 0, 0, 0.08)',
    BORDER_LIGHT: 'rgba(0, 0, 0, 0.05)',
    BOX_SHADOW: {
        DEFAULT: '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)',
        INPUT_FOCUS: '0 0 0 3px rgba(0, 113, 227, 0.32)',
        CARD: '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)',
        PHOTO_CARD: 'rgba(0, 0, 0, 0.22) 3px 5px 30px 0px',
    },
    PROGRESS: {
        BLUE: '#0071e3',
        BLUE_DARK: '#0055d4',
        GREEN: '#10b981',
        GREEN_DARK: '#059669',
    },
    BUTTON: {
        WHITE_BG: '#fafafc',
        WHITE_HOVER: '#ededf2',
        DISABLED_TEXT: 'rgba(0, 0, 0, 0.28)',
        ERROR_HOVER: '#fff5f5',
    },
    FLAG: {
        OWNER_BG: 'rgba(0, 113, 227, 0.08)',
        OWNER_BORDER: 'rgba(0, 113, 227, 0.2)',
        SHARED_BG: '#f5f5f7',
        SHARED_BORDER: 'rgba(0, 0, 0, 0.1)',
    },
    HASHTAG: {
        DEFAULT_BG: 'rgba(0, 0, 0, 0.06)',
        DEFAULT_TEXT: 'rgba(0, 0, 0, 0.48)',
    },
} as const;

export const THEME_COLORS: Record<ThemeType, { TEXT: string; BACKGROUND: string; BORDER?: string }> = {
    default: { TEXT: 'rgba(0, 0, 0, 0.8)', BACKGROUND: '#f5f5f7' },
    primary: { TEXT: '#1d1d1f', BACKGROUND: 'rgba(0, 113, 227, 0.06)' },
    success: { TEXT: '#065f46', BACKGROUND: '#f0fdf4' },
    warning: { TEXT: '#92400e', BACKGROUND: '#fffbeb', BORDER: '1px solid rgba(245, 158, 11, 0.3)' },
    error: { TEXT: '#ef4444', BACKGROUND: '#fff5f5' },
};

export const FONT_SIZES = {
    XS: '10px',
    SM: '12px',
    MD: '14px',
    LG: '17px',
    XL: '21px',
    XXL: '28px',
    XXXL: '40px',
} as const;

export const SPACING = {
    XXS: '2px',
    XS: '4px',
    SM: '8px',
    MD: '12px',
    LG: '16px',
    XL: '24px',
    XXL: '32px',
    XXXL: '48px',
} as const;
