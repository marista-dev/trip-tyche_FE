/**
 * 오빗 링 티켓을 캔버스에 그린다. TripTicket(탑승권)·DayPassTicket(1-Day 패스)을 작게 줄인 모양.
 * WebGL 텍스처로 쓰므로 DOM 대신 Canvas 2D로 그린다. 좌표는 TICKET_W × TICKET_H 논리 픽셀 기준.
 */
import { RoutePoint } from '@/domains/trip/destinations';
import { TicketView } from '@/domains/trip/ticketView';
import { COLORS } from '@/shared/constants/style';

export const TICKET_W = 300;
export const TICKET_H = 240;
/** 카드 텍스처 배율 상한. 실제 배율은 정면 카드가 화면에서 차지하는 픽셀에 맞춘다(TicketRing) */
export const MAX_TEXTURE_SCALE = 2.5;

/** 앞면에 그리는 커버 사진. ImageBitmap(줄여서 디코딩) 또는 <img>(대체 경로) */
export type CoverImage = CanvasImageSource & { width: number; height: number };
const HERO_H = 150;
const RADIUS = 18;
const DAY_STUB_W = 66;

const KO_FONT = "'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
const EN_FONT = `'Outfit', ${KO_FONT}`;
/** 텍스처에 쓰는 웹폰트. 그리기 전에 로드를 기다려야 첫 프레임부터 글꼴이 맞는다 */
const TICKET_FONTS = ["800 20px 'Outfit'", "600 8px 'Outfit'"];

/** 웹폰트 로드를 기다린다. 실패해도(오프라인 등) 대체 글꼴로 그리도록 항상 resolve */
export const waitForTicketFonts = (): Promise<void> =>
    Promise.all(TICKET_FONTS.map((f) => document.fonts.load(f))).then(
        () => undefined,
        () => undefined,
    );

export interface RingTicket {
    tripKey: string;
    title: string;
    view: TicketView;
    /** false면 작성 중인 티켓 */
    completed: boolean;
    passenger: string;
    /** 아직 모르면 null */
    photoCount: number | null;
}

type Ctx = CanvasRenderingContext2D;

/** Safari(iOS 포함)는 CanvasRenderingContext2D.filter가 없다. 값을 넣어도 무시되고 흐림 없이 그려진다 */
const CANVAS_FILTER = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;
/** 대체 흐림: 이 배율로 줄였다 늘린다. Chrome에서 비교해 blur(10px)와 가장 비슷했다(8은 너무 또렷함) */
const SOFT_BLUR_DOWNSCALE = 16;

const roundRect = (x: Ctx, left: number, top: number, w: number, h: number, r: number) => {
    x.beginPath();
    x.roundRect(left, top, w, h, r);
};

const setFont = (x: Ctx, font: string, spacing = 0) => {
    x.font = font;
    // letterSpacing 미지원 WebView에서는 무시된다(글자 간격만 기본값)
    (x as Ctx & { letterSpacing?: string }).letterSpacing = `${spacing}px`;
};

const ellipsis = (x: Ctx, text: string, max: number) => {
    if (x.measureText(text).width <= max) return text;
    let t = text;
    while (t.length > 1 && x.measureText(`${t}…`).width > max) t = t.slice(0, -1);
    return `${t}…`;
};

/**
 * ticketView의 fallbackBg(oklch 그라데이션)를 캔버스 그라데이션으로 옮긴다.
 * oklch를 모르는 오래된 WebView에서는 addColorStop이 예외를 던지므로 무채색으로 대신한다.
 */
const fillFallback = (x: Ctx, fallbackBg: string, w: number, h: number) => {
    const stops = fallbackBg.match(/oklch\([^)]*\)/g) ?? [];
    const g = x.createLinearGradient(0, 0, w, h);
    try {
        g.addColorStop(0, stops[0] ?? '#94a3b8');
        g.addColorStop(1, stops[1] ?? '#334155');
    } catch {
        g.addColorStop(0, '#94a3b8');
        g.addColorStop(1, '#334155');
    }
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
};

/** object-fit: cover + object-position: center 35% (TripTicket의 coverPhotoStyle과 같은 크롭) */
const drawCover = (
    x: Ctx,
    img: CanvasImageSource & { width: number; height: number },
    w: number,
    h: number,
    left = 0,
) => {
    const s = Math.max(w / img.width, h / img.height);
    const iw = img.width * s;
    const ih = img.height * s;
    x.drawImage(img, left + (w - iw) / 2, (h - ih) * 0.35, iw, ih);
};

const pill = (
    x: Ctx,
    left: number,
    top: number,
    text: string,
    {
        dot = COLORS.PRIMARY as string | null,
        bg = 'rgba(255,255,255,.2)',
        font = `800 8.5px ${EN_FONT}`,
        spacing = 1,
    } = {},
) => {
    setFont(x, font, spacing);
    const w = x.measureText(text).width + (dot ? 26 : 16);
    x.fillStyle = bg;
    roundRect(x, left, top, w, 19, 10);
    x.fill();
    if (dot) {
        x.fillStyle = dot;
        x.beginPath();
        x.arc(left + 10, top + 9.5, 2.5, 0, Math.PI * 2);
        x.fill();
    }
    x.fillStyle = '#fff';
    x.textBaseline = 'middle';
    x.fillText(text, left + (dot ? 17 : 8), top + 10);
    x.textBaseline = 'alphabetic';
    return w;
};

/** RouteEnd 컴포넌트와 같은 규칙: 해외는 공항 코드, 국내는 지명 + 영문 보조 표기(출발은 한 톤 낮춤) */
const routeEndWidth = (x: Ctx, p: RoutePoint, isTo: boolean) => {
    setFont(x, p.isCode ? `800 20px ${EN_FONT}` : `800 ${isTo ? 18 : 14}px ${KO_FONT}`);
    return x.measureText(p.label).width;
};

const drawRouteEnd = (x: Ctx, p: RoutePoint, at: number, y: number, isTo: boolean) => {
    x.textAlign = isTo ? 'right' : 'left';
    if (p.isCode) {
        x.fillStyle = '#fff';
        setFont(x, `800 20px ${EN_FONT}`, -0.6);
        x.fillText(p.label, at, y + 7);
    } else {
        x.fillStyle = isTo ? '#fff' : 'rgba(255,255,255,.7)';
        setFont(x, `800 ${isTo ? 18 : 14}px ${KO_FONT}`, -0.5);
        x.fillText(p.label, at, y + 2);
        if (p.sub) {
            x.fillStyle = 'rgba(255,255,255,.5)';
            setFont(x, `600 7px ${EN_FONT}`, 1.3);
            x.fillText(p.sub, at, y + 13);
        }
    }
    x.textAlign = 'left';
};

const PLANE_PATH = 'M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z';

const punch = (x: Ctx, holes: [number, number, number][]) => {
    x.globalCompositeOperation = 'destination-out';
    x.beginPath();
    holes.forEach(([cx, cy, r]) => {
        x.moveTo(cx + r, cy);
        x.arc(cx, cy, r, 0, Math.PI * 2);
    });
    x.fill();
    x.globalCompositeOperation = 'source-over';
};

const drawBoardingPass = (x: Ctx, t: RingTicket, cover: CoverImage | null) => {
    const { view } = t;
    x.save();
    roundRect(x, 0, 0, TICKET_W, TICKET_H, RADIUS);
    x.clip();
    x.fillStyle = COLORS.TICKET_BAND;
    x.fillRect(0, 0, TICKET_W, TICKET_H);

    // hero
    x.save();
    x.beginPath();
    x.rect(0, 0, TICKET_W, HERO_H);
    x.clip();
    fillFallback(x, view.fallbackBg, TICKET_W, HERO_H);
    if (cover) drawCover(x, cover, TICKET_W, HERO_H);
    let g = x.createLinearGradient(0, 0, 0, HERO_H);
    g.addColorStop(0, 'rgba(0,0,0,.08)');
    g.addColorStop(0.3, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, TICKET_W, HERO_H);
    g = x.createLinearGradient(0, 0, 0, HERO_H);
    g.addColorStop(0.55, 'rgba(15,23,42,0)');
    g.addColorStop(0.88, 'rgba(15,23,42,.7)');
    g.addColorStop(1, 'rgba(15,23,42,.95)');
    x.fillStyle = g;
    x.fillRect(0, 0, TICKET_W, HERO_H);
    if (!t.completed) {
        x.fillStyle = 'rgba(15,23,42,.38)';
        x.fillRect(0, 0, TICKET_W, HERO_H);
    }
    x.restore();

    pill(x, 12, 11, 'TYCHE AIR');
    if (!t.completed) {
        pill(x, TICKET_W / 2 - 44, 58, '작성 중인 티켓', {
            dot: '#fbbf24',
            bg: 'rgba(15,23,42,.55)',
            font: `700 9.5px ${KO_FONT}`,
            spacing: 0,
        });
    }

    x.fillStyle = 'rgba(255,255,255,.7)';
    setFont(x, `600 8.5px ${EN_FONT}`, 0.3);
    if (view.dateLine) x.fillText(view.dateLine, 14, HERO_H - 30);
    x.fillStyle = '#fff';
    setFont(x, `700 16px ${KO_FONT}`, -0.3);
    x.fillText(ellipsis(x, t.completed ? t.title : '여행 정보를 이어서 작성해 주세요', TICKET_W - 28), 14, HERO_H - 11);

    // route row
    const ry = HERO_H + 24;
    drawRouteEnd(x, view.from, 16, ry, false);
    drawRouteEnd(x, view.to, TICKET_W - 16, ry, true);
    const lineFrom = 16 + routeEndWidth(x, view.from, false) + 12;
    const lineTo = TICKET_W - 16 - routeEndWidth(x, view.to, true) - 12;
    x.strokeStyle = 'rgba(255,255,255,.4)';
    x.lineWidth = 1;
    x.setLineDash([3, 4]);
    x.beginPath();
    x.moveTo(lineFrom, ry);
    x.lineTo(lineTo, ry);
    x.stroke();
    x.setLineDash([]);
    x.save();
    x.translate((lineFrom + lineTo) / 2, ry);
    x.rotate(Math.PI / 2);
    x.scale(0.5, 0.5);
    x.translate(-12, -12);
    x.fillStyle = COLORS.TICKET_BAND;
    x.fillRect(4, 4, 16, 16);
    x.fillStyle = '#fff';
    x.fill(new Path2D(PLANE_PATH));
    x.restore();

    // meta row
    const meta: [string, string][] = [
        ['PASSENGER', t.passenger || '—'],
        ['DURATION', view.duration],
        ['PHOTOS', t.photoCount === null ? '—' : `${t.photoCount}장`],
    ];
    meta.forEach(([label, value], i) => {
        const left = [16, 118, 220][i];
        x.fillStyle = 'rgba(255,255,255,.45)';
        setFont(x, `600 7px ${EN_FONT}`, 1.2);
        x.fillText(label, left, HERO_H + 58);
        x.fillStyle = i === 2 && t.photoCount !== null ? COLORS.PRIMARY : '#fff';
        setFont(x, `700 11px ${KO_FONT}`);
        x.fillText(ellipsis(x, value, 92), left, HERO_H + 73);
    });
    x.restore();

    // 사진과 띠 경계의 반원 구멍 (TripTicket의 notchMask와 같은 자리)
    punch(x, [
        [24, HERO_H, 7],
        [TICKET_W - 24, HERO_H, 7],
    ]);
};

/** DayPassTicket과 같은 구성: 사진 전체 + 아래쪽 어둡게 + 오른쪽 네이비 유리 옆면 */
const drawDayPass = (x: Ctx, t: RingTicket, cover: CoverImage | null) => {
    const { view } = t;
    const stubX = TICKET_W - DAY_STUB_W;
    // 사진 중심을 옆면 왼쪽(보이는 영역) 가운데에 맞추고, 옆면 폭만큼 왼쪽으로 넓혀 카드 전체를 채운다
    const paintPhoto = () => {
        fillFallback(x, view.fallbackBg, TICKET_W, TICKET_H);
        if (cover) drawCover(x, cover, TICKET_W + DAY_STUB_W, TICKET_H, -DAY_STUB_W);
    };

    x.save();
    roundRect(x, 0, 0, TICKET_W, TICKET_H, RADIUS);
    x.clip();
    paintPhoto();
    const g = x.createLinearGradient(0, 0, 0, TICKET_H);
    g.addColorStop(0, 'rgba(0,0,0,.18)');
    g.addColorStop(0.26, 'rgba(0,0,0,0)');
    g.addColorStop(0.44, 'rgba(15,23,42,0)');
    g.addColorStop(0.72, 'rgba(15,23,42,.5)');
    g.addColorStop(1, 'rgba(15,23,42,.86)');
    x.fillStyle = g;
    x.fillRect(0, 0, TICKET_W, TICKET_H);

    // 유리 옆면: 뒤 사진을 흐리게 다시 그린 뒤 네이비 막(backdrop-filter: blur(24px) saturate(1.4) 대응)
    x.save();
    x.beginPath();
    x.rect(stubX, 0, DAY_STUB_W, TICKET_H);
    x.clip();
    if (CANVAS_FILTER) {
        x.filter = 'blur(10px) saturate(1.4)';
        paintPhoto();
        x.filter = 'none';
    } else {
        // Safari는 ctx.filter가 없다. 작게 그렸다가 늘려 그려 흐림을 흉내 낸다(bakeStub의 대체 경로와 같은 방식, 채도 보정은 생략)
        const small = document.createElement('canvas');
        small.width = Math.ceil(TICKET_W / SOFT_BLUR_DOWNSCALE);
        small.height = Math.ceil(TICKET_H / SOFT_BLUR_DOWNSCALE);
        const s = small.getContext('2d');
        if (s) {
            s.scale(1 / SOFT_BLUR_DOWNSCALE, 1 / SOFT_BLUR_DOWNSCALE);
            fillFallback(s, view.fallbackBg, TICKET_W, TICKET_H);
            if (cover) drawCover(s, cover, TICKET_W + DAY_STUB_W, TICKET_H, -DAY_STUB_W);
            x.imageSmoothingQuality = 'high';
            // 작은 캔버스는 정수로 올림돼 내용(TICKET_W/배율)보다 조금 넓다. 내용 영역만 잘라 늘려야 오른쪽에 빈 띠가 안 생긴다
            x.drawImage(
                small,
                0,
                0,
                TICKET_W / SOFT_BLUR_DOWNSCALE,
                TICKET_H / SOFT_BLUR_DOWNSCALE,
                0,
                0,
                TICKET_W,
                TICKET_H,
            );
        } else {
            paintPhoto();
        }
    }
    x.fillStyle = 'rgba(15,23,42,.58)';
    x.fillRect(stubX, 0, DAY_STUB_W, TICKET_H);
    x.fillStyle = 'rgba(255,255,255,.08)';
    x.fillRect(stubX + 2, 0, 1, TICKET_H);
    x.restore();
    // 절취선(6px 선 / 4px 간격, 2px 폭)
    x.fillStyle = 'rgba(255,255,255,.5)';
    for (let y = 0; y < TICKET_H; y += 10) x.fillRect(stubX, y, 2, 6);

    const cx = stubX + 1 + DAY_STUB_W / 2;
    const cy = TICKET_H / 2;
    x.fillStyle = '#fff';
    x.textAlign = 'center';
    setFont(x, `800 30px ${EN_FONT}`, -1.2);
    x.fillText('1', cx, cy - 16);
    setFont(x, `800 8.5px ${EN_FONT}`, 2);
    x.fillText('DAY', cx + 1, cy);
    x.fillText('PASS', cx + 1, cy + 10);
    if (view.placeEn) {
        // writing-mode: vertical-rl — 글자를 시계 방향으로 눕혀 위에서 아래로
        x.save();
        x.translate(cx, cy + 22);
        x.rotate(Math.PI / 2);
        x.textAlign = 'left';
        x.fillStyle = 'rgba(255,255,255,.7)';
        setFont(x, `700 8.5px ${EN_FONT}`, 2);
        x.fillText(view.placeEn, 0, 3);
        x.restore();
    }
    x.textAlign = 'left';

    pill(x, 12, 11, 'TYCHE PASS', { bg: 'rgba(255,255,255,.22)' });
    x.fillStyle = 'rgba(255,255,255,.85)';
    setFont(x, `600 10px ${EN_FONT}`, 0);
    x.fillText(view.dateLine, 14, TICKET_H - 36);
    x.fillStyle = '#fff';
    setFont(x, `700 16px ${KO_FONT}`, -0.4);
    x.fillText(ellipsis(x, t.title, stubX - 28), 14, TICKET_H - 16);
    x.restore();

    punch(x, [
        [stubX + 1, 0, 8],
        [stubX + 1, TICKET_H, 8],
    ]);
};

/** 앞면을 다시 그린다. 사진이 늦게 도착하면 같은 캔버스에 덮어 그린다 */
export const drawTicketFront = (
    canvas: HTMLCanvasElement,
    ticket: RingTicket,
    cover: CoverImage | null,
    scale: number,
) => {
    const x = canvas.getContext('2d');
    if (!x) return;
    x.setTransform(scale, 0, 0, scale, 0, 0);
    x.clearRect(0, 0, TICKET_W, TICKET_H);
    if (ticket.view.isDayTrip) drawDayPass(x, ticket, cover);
    else drawBoardingPass(x, ticket, cover);
};

/** 링 뒤쪽으로 돌아간 카드에 보이는 뒷면 (모든 카드 공용) */
export const createTicketBackCanvas = (scale: number) => {
    const c = document.createElement('canvas');
    c.width = TICKET_W * scale;
    c.height = TICKET_H * scale;
    const x = c.getContext('2d');
    if (!x) return c;
    x.scale(scale, scale);
    roundRect(x, 0, 0, TICKET_W, TICKET_H, RADIUS);
    x.clip();
    x.fillStyle = COLORS.TICKET_BAND;
    x.fillRect(0, 0, TICKET_W, TICKET_H);
    x.fillStyle = 'rgba(255,255,255,.07)';
    for (let yy = 12; yy < TICKET_H; yy += 13) {
        for (let xx = 12 + ((yy / 13) % 2) * 6.5; xx < TICKET_W; xx += 13) {
            x.beginPath();
            x.arc(xx, yy, 1.5, 0, Math.PI * 2);
            x.fill();
        }
    }
    x.fillStyle = COLORS.PRIMARY;
    x.beginPath();
    x.arc(TICKET_W / 2 - 52, TICKET_H / 2 - 4, 3.5, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#fff';
    x.textAlign = 'center';
    setFont(x, `800 15px ${EN_FONT}`, 4);
    x.fillText('TYCHE AIR', TICKET_W / 2 + 6, TICKET_H / 2 + 1);
    x.fillStyle = 'rgba(255,255,255,.4)';
    setFont(x, `600 7.5px ${EN_FONT}`, 2.5);
    x.fillText('BOARDING PASS', TICKET_W / 2, TICKET_H / 2 + 18);
    return c;
};

/** 카드 아래 깔리는 흐린 그림자 */
/** 그림자 텍스처의 기준 크기. 카드 그림자 평면(폭 1.3배, 높이 1.45배)이 이 크기에 대응한다 */
export const SHADOW_BASE_W = 340;
export const SHADOW_BASE_H = 280;
/** 흐림이 캔버스 가장자리에서 잘리지 않게 사방에 더하는 투명 여백. shadowBlur 32(σ≈16)는 약 48px까지 번진다 */
export const SHADOW_PAD = 24;

export const createShadowCanvas = () => {
    const c = document.createElement('canvas');
    c.width = SHADOW_BASE_W + SHADOW_PAD * 2;
    c.height = SHADOW_BASE_H + SHADOW_PAD * 2;
    const x = c.getContext('2d');
    if (!x) return c;
    /*
     * Safari(iOS 포함)는 ctx.filter를 지원하지 않는다. filter = 'blur()'는 무시되고 테두리가 또렷한 사각형이 그려져
     * 카드 아래로 짙은 띠가 보였다. 모든 브라우저가 지원하는 shadowBlur로 흐림을 만든다.
     * 도형은 캔버스 밖에 그리고 그림자만 제자리로 옮겨, 흐린 그림자만 남긴다(blur(16px) ≈ shadowBlur 32).
     */
    const offscreen = c.width * 2;
    x.shadowColor = 'rgba(15,23,42,.75)';
    x.shadowBlur = 32;
    x.shadowOffsetX = offscreen;
    x.fillStyle = '#000';
    roundRect(x, SHADOW_PAD + 40 - offscreen, SHADOW_PAD + 45, 260, 190, 20);
    x.fill();
    return c;
};
