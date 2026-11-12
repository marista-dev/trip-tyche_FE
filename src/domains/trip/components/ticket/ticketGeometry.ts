export const TICKET_RADIUS = 20;

export const DAY_PASS_HEIGHT = {
    ticketList: 268,
    preview: 270,
    compactPreview: 208,
} as const;

export const DAY_PASS_STUB = {
    width: 82,
    notchRadius: 9,
    notchOffsetX: 1,
    perforationWidth: 2,
    perforationDash: 6,
    perforationPeriod: 10,
    perforationColor: 'rgba(255, 255, 255, 0.5)',
    highlightColor: 'rgba(255, 255, 255, 0.08)',
    glassColor: 'rgba(15, 23, 42, 0.58)',
    blurPx: 24,
    saturate: 1.4,
} as const;

export const DAY_PASS_SHADE_STOPS = [
    { percent: 0, color: 'rgba(0, 0, 0, 0.18)' },
    { percent: 26, color: 'transparent' },
    { percent: 44, color: 'transparent' },
    { percent: 72, color: 'rgba(15, 23, 42, 0.5)' },
    { percent: 100, color: 'rgba(15, 23, 42, 0.86)' },
] as const;

export const BOARDING_PASS = {
    heroHeight: 200,
    notchRadius: 8,
    notchInset: 28,
} as const;
