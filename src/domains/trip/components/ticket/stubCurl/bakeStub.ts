/**
 * HTML 옆면(유리 질감 + 절취선 + 글자)을 캔버스에 똑같이 굽는다.
 * WebGL 조각으로 바꿔치기하는 순간이 눈에 띄지 않으려면 픽셀 단위로 맞아야 한다.
 */

const STUB_RADIUS = 20;
/** 블러 가장자리가 비지 않도록 배경을 이만큼 더 그린다 */
const BLUR_PAD = 72;
/** HTML 옆면 배경과 같은 유리 색 */
export const GLASS = 'rgba(15, 23, 42, 0.58)';
const SLATE = '#334155';

export interface BakedStub {
    canvas: HTMLCanvasElement;
    /** 말림 안쪽 면(뒷면) */
    back: HTMLCanvasElement;
    width: number;
    height: number;
}

export interface GradientStop {
    color: string;
    /** 0~1 */
    at: number;
}

export interface ParsedGradient {
    angleDeg: number;
    stops: GradientStop[];
}

/** 괄호 안의 쉼표(rgb(…), oklch는 공백)를 건너뛰고 최상위 쉼표로만 나눈다 */
const splitTopLevel = (s: string) => {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '(') depth++;
        else if (s[i] === ')') depth--;
        else if (s[i] === ',' && depth === 0) {
            parts.push(s.slice(start, i).trim());
            start = i + 1;
        }
    }
    parts.push(s.slice(start).trim());
    return parts;
};

/** "linear-gradient(135deg, A 0%, B 100%)" → 캔버스로 다시 그릴 수 있는 값. 모르는 형식이면 null */
export const parseLinearGradient = (value: string): ParsedGradient | null => {
    const m = /^linear-gradient\((.*)\)$/s.exec(value.trim());
    if (!m) return null;
    const parts = splitTopLevel(m[1]);
    let angleDeg = 180;
    if (/^-?[\d.]+deg$/.test(parts[0])) angleDeg = parseFloat(parts.shift()!);
    else if (parts[0].startsWith('to ')) return null;
    if (parts.length < 2) return null;
    const stops = parts.map((part, i) => {
        const pos = /\s(-?[\d.]+)%$/.exec(part);
        return {
            color: pos ? part.slice(0, pos.index).trim() : part,
            at: pos ? parseFloat(pos[1]) / 100 : i / (parts.length - 1),
        };
    });
    return { angleDeg, stops };
};

/** CSS 각도 그라디언트를 w×h 상자 기준으로 만든다 (0deg=위쪽, 시계 방향) */
const cssLinearGradient = (
    g: CanvasRenderingContext2D,
    grad: ParsedGradient,
    x: number,
    y: number,
    w: number,
    h: number,
) => {
    const a = (grad.angleDeg * Math.PI) / 180;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const lg = g.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
    for (const stop of grad.stops) {
        // 캔버스가 모르는 색(구형 브라우저의 oklch 등)이면 addColorStop이 던진다 → 호출부에서 단색으로
        lg.addColorStop(Math.min(1, Math.max(0, stop.at)), stop.color);
    }
    return lg;
};

/** object-fit: cover + object-position (x 50%, y posY) */
const coverRect = (iw: number, ih: number, w: number, h: number, posY: number) => {
    const k = Math.max(w / iw, h / ih);
    return [(w - iw * k) / 2, (h - ih * k) * posY, iw * k, ih * k] as const;
};

const parsePercent = (value: string, fallback: number) => {
    const m = /(-?[\d.]+)%/.exec(value);
    return m ? parseFloat(m[1]) / 100 : fallback;
};

const rightRoundRect = (g: CanvasRenderingContext2D, w: number, h: number, r: number) => {
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(w - r, 0);
    g.arcTo(w, 0, w, r, r);
    g.lineTo(w, h - r);
    g.arcTo(w, h, w - r, h, r);
    g.lineTo(0, h);
    g.closePath();
};

/** 글자 요소 하나를 같은 자리·같은 자간으로 그린다(세로쓰기 포함) */
const drawTextEl = (g: CanvasRenderingContext2D, el: Element, ox: number, oy: number) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const size = parseFloat(cs.fontSize);
    const spacing = parseFloat(cs.letterSpacing) || 0;
    g.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    g.fillStyle = cs.color;
    g.textBaseline = 'alphabetic';
    const m = g.measureText('HgDAY');
    const asc = m.fontBoundingBoxAscent ?? size * 0.8;
    const desc = m.fontBoundingBoxDescent ?? size * 0.2;
    const text = el.textContent ?? '';
    const run = (x: number, base: number) => {
        for (const ch of text) {
            g.fillText(ch, x, base);
            x += g.measureText(ch).width + spacing;
        }
    };
    const x0 = r.left - ox;
    const y0 = r.top - oy;
    if (!cs.writingMode.startsWith('vertical')) {
        run(x0 + (parseFloat(cs.paddingLeft) || 0), y0 + (r.height - (asc + desc)) / 2 + asc);
        return;
    }
    const lineH = r.width;
    g.save();
    g.translate(x0 + lineH / 2, y0 + (parseFloat(cs.paddingTop) || 0));
    g.rotate(Math.PI / 2);
    run(0, -lineH / 2 + (lineH - (asc + desc)) / 2 + asc);
    g.restore();
};

/** 옆면 뒤 배경(사진 또는 기본 그라디언트 + 아래 어둡게)을 배율 1로 그린다 */
const drawBackdrop = (pass: HTMLElement, photo: HTMLImageElement | null, stubLeft: number) => {
    const W = pass.getBoundingClientRect().width;
    const H = pass.getBoundingClientRect().height;
    const P = BLUR_PAD;
    // 블러가 닿는 옆면 주변만 그린다 — 패스 전체를 그리면 저사양 기기에서 굽는 시간이 길어진다
    const ox = stubLeft - P;
    const c = document.createElement('canvas');
    c.width = Math.ceil(W - ox + P);
    c.height = Math.ceil(H + 2 * P);
    const g = c.getContext('2d')!;
    g.translate(-ox, P);
    g.fillStyle = SLATE;
    g.fillRect(ox, -P, c.width, c.height);

    if (photo) {
        // 실제 <img> 상자(옆면 아래로 밀려 있는 위치·크기)를 그대로 따른다
        const img = pass.querySelector('img')!;
        const pr = pass.getBoundingClientRect();
        const ir = img.getBoundingClientRect();
        const [bx, by, bw, bh] = [ir.left - pr.left, ir.top - pr.top, ir.width, ir.height];
        const posY = parsePercent(getComputedStyle(img).objectPosition.split(' ')[1] ?? '', 0.5);
        // 블러 여백까지 채우는 바탕 한 장, 그 위에 실제 상자 그대로 한 장
        let [x, y, w, h] = coverRect(photo.naturalWidth, photo.naturalHeight, bw + 2 * P, bh + 2 * P, posY);
        g.drawImage(photo, bx - P + x, by - P + y, w, h);
        [x, y, w, h] = coverRect(photo.naturalWidth, photo.naturalHeight, bw, bh, posY);
        g.drawImage(photo, bx + x, by + y, w, h);
    } else {
        const grad = parseLinearGradient(getComputedStyle(pass).backgroundImage);
        if (grad) {
            try {
                g.fillStyle = cssLinearGradient(g, grad, 0, 0, W, H);
            } catch {
                g.fillStyle = SLATE;
            }
            g.fillRect(ox, -P, c.width, c.height);
        }
    }

    // pass::after 와 같은 세로 그라디언트
    const shade = g.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, 'rgba(0,0,0,.18)');
    shade.addColorStop(0.26, 'rgba(0,0,0,0)');
    shade.addColorStop(0.44, 'rgba(0,0,0,0)');
    shade.addColorStop(0.72, 'rgba(15,23,42,.5)');
    shade.addColorStop(1, 'rgba(15,23,42,.86)');
    g.fillStyle = shade;
    g.fillRect(ox, -P, c.width, c.height);
    return c;
};

/** 면마다 굽는 층. 안쪽 면은 흐린 배경 + 같은 유리 색만 — 글자·절취선·흰 종이 없이 같은 조각으로 읽히게 */
export const STUB_LAYERS = {
    front: ['backdrop', 'glass', 'highlight', 'perforation', 'text'],
    back: ['backdrop', 'glass'],
} as const;
export type StubLayer = (typeof STUB_LAYERS)['front'][number];

/** 블러 처리한 배경(backdrop-filter: blur(24px) saturate(1.4))을 조각 크기로 */
const drawBlurred = (g: CanvasRenderingContext2D, backdrop: HTMLCanvasElement, S: number) => {
    const bw = backdrop.width * S;
    const bh = backdrop.height * S;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (typeof g.filter === 'string') {
        g.filter = `blur(${24 * S}px) saturate(1.4)`;
        g.drawImage(backdrop, -BLUR_PAD * S, -BLUR_PAD * S, bw, bh);
        g.filter = 'none';
    } else {
        // ctx.filter가 없는 브라우저(Safari): 줄였다 키워서 블러 흉내
        const small = document.createElement('canvas');
        small.width = Math.max(1, Math.round(backdrop.width / 18));
        small.height = Math.max(1, Math.round(backdrop.height / 18));
        const sg = small.getContext('2d')!;
        sg.imageSmoothingQuality = 'high';
        sg.drawImage(backdrop, 0, 0, small.width, small.height);
        g.imageSmoothingQuality = 'high';
        g.drawImage(small, -BLUR_PAD * S, -BLUR_PAD * S, bw, bh);
    }
    g.setTransform(S, 0, 0, S, 0, 0);
};

const drawFace = (
    layers: readonly StubLayer[],
    stub: HTMLElement,
    backdrop: HTMLCanvasElement,
    w: number,
    h: number,
    S: number,
) => {
    const sr = stub.getBoundingClientRect();
    const c = document.createElement('canvas');
    c.width = Math.round(w * S);
    c.height = Math.round(h * S);
    const g = c.getContext('2d')!;
    g.setTransform(S, 0, 0, S, 0, 0);
    g.save();
    rightRoundRect(g, w, h, STUB_RADIUS);
    g.clip();
    for (const layer of layers) {
        if (layer === 'backdrop') drawBlurred(g, backdrop, S);
        else if (layer === 'glass') {
            g.fillStyle = GLASS;
            g.fillRect(0, 0, w, h);
        } else if (layer === 'highlight') {
            // inset 1px 하이라이트(테두리 2px 안쪽)
            g.fillStyle = 'rgba(255,255,255,.08)';
            g.fillRect(2, 0, 1, h);
        } else if (layer === 'perforation') {
            // 절취선: CSS와 같은 6px 선 / 4px 간격
            g.fillStyle = 'rgba(255,255,255,.5)';
            for (let y = 0; y < h; y += 10) g.fillRect(0, y, 2, Math.min(6, h - y));
        } else {
            // 글자를 직접 가진 요소만(DAY·PASS 묶음 같은 래퍼는 건너뛴다)
            for (const el of Array.from(stub.querySelectorAll('*'))) {
                if (el.childElementCount === 0) drawTextEl(g, el, sr.left, sr.top);
            }
        }
    }
    g.restore();

    // 절취선 위아래 반원 구멍은 뚫어서 비운다
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(1, 0, 9, 0, Math.PI * 2);
    g.moveTo(10, h);
    g.arc(1, h, 9, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    return c;
};

/**
 * 옆면 앞·안쪽 면을 굽는다. photo가 있으면 흐린 사진 위 어두운 유리, 없으면 기본 그라디언트 위 유리.
 * photo는 crossOrigin으로 받은 이미지여야 한다 — 아니면 텍스처 업로드가 막힌다.
 */
export const bakeStub = (stub: HTMLElement, photo: HTMLImageElement | null): BakedStub => {
    const pass = stub.parentElement!;
    const pr = pass.getBoundingClientRect();
    const sr = stub.getBoundingClientRect();
    const S = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
    const w = sr.width;
    const h = pr.height;
    const backdrop = drawBackdrop(pass, photo, sr.left - pr.left);
    return {
        canvas: drawFace(STUB_LAYERS.front, stub, backdrop, w, h, S),
        back: drawFace(STUB_LAYERS.back, stub, backdrop, w, h, S),
        width: w,
        height: h,
    };
};

/** CORS로 사진을 다시 받는다. 실패·시간 초과면 null(사진 없이 굽는다) */
export const loadCorsImage = (src: string | undefined, timeoutMs: number): Promise<HTMLImageElement | null> => {
    if (!src) return Promise.resolve(null);
    return new Promise((resolve) => {
        const img = new Image();
        const timer = setTimeout(() => resolve(null), timeoutMs);
        img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.onload = () => {
            clearTimeout(timer);
            resolve(img);
        };
        img.onerror = () => {
            clearTimeout(timer);
            resolve(null);
        };
        img.src = src;
    });
};

/** 캔버스가 오염됐는지(교차 출처 이미지) — 오염되면 WebGL 업로드가 SecurityError를 던진다 */
export const isTainted = (canvas: HTMLCanvasElement) => {
    try {
        canvas.getContext('2d')!.getImageData(0, 0, 1, 1);
        return false;
    } catch {
        return true;
    }
};
