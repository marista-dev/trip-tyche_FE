import { createCanvasLinearGradient, parseLinearGradient } from './cssGradient';
import { DAY_PASS_SHADE_STOPS, DAY_PASS_STUB, TICKET_RADIUS } from '../ticketGeometry';

// HTML 옆면을 캔버스에 픽셀 단위로 똑같이 굽는다 — 다르면 WebGL 조각으로 바꿔치기하는 순간이 보인다

/** 블러 가장자리가 비지 않도록 배경을 이만큼 더 그린다 */
const BLUR_PAD = 72;
const BACKDROP_FALLBACK_COLOR = '#334155';
const MAX_BAKE_SCALE = 3;
/** ctx.filter가 없는 브라우저(Safari)는 줄였다 키워 블러를 흉내 낸다 */
const SOFTWARE_BLUR_DOWNSCALE = 18;
const FONT_METRICS_SAMPLE = 'HgDAY';

export interface BakedStub {
    front: HTMLCanvasElement;
    back: HTMLCanvasElement;
    width: number;
    height: number;
}

export const STUB_LAYERS = {
    front: ['backdrop', 'glass', 'highlight', 'perforation', 'text'],
    back: ['backdrop', 'glass'],
} as const;
export type StubLayer = (typeof STUB_LAYERS)['front'][number];

const createCanvas = (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext('2d')! };
};

/** object-fit: cover + object-position: 50% {positionY} */
const coverRect = (imageWidth: number, imageHeight: number, boxWidth: number, boxHeight: number, positionY: number) => {
    const scale = Math.max(boxWidth / imageWidth, boxHeight / imageHeight);
    return [
        (boxWidth - imageWidth * scale) / 2,
        (boxHeight - imageHeight * scale) * positionY,
        imageWidth * scale,
        imageHeight * scale,
    ] as const;
};

const parsePercent = (value: string, fallback: number) => {
    const match = /(-?[\d.]+)%/.exec(value);
    return match ? parseFloat(match[1]) / 100 : fallback;
};

const traceRightRoundedRect = (ctx: CanvasRenderingContext2D, width: number, height: number, radius: number) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width - radius, 0);
    ctx.arcTo(width, 0, width, radius, radius);
    ctx.lineTo(width, height - radius);
    ctx.arcTo(width, height, width - radius, height, radius);
    ctx.lineTo(0, height);
    ctx.closePath();
};

const drawTextElement = (ctx: CanvasRenderingContext2D, element: Element, originX: number, originY: number) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const fontSize = parseFloat(style.fontSize);
    const letterSpacing = parseFloat(style.letterSpacing) || 0;
    ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
    ctx.fillStyle = style.color;
    ctx.textBaseline = 'alphabetic';
    const metrics = ctx.measureText(FONT_METRICS_SAMPLE);
    const ascent = metrics.fontBoundingBoxAscent ?? fontSize * 0.8;
    const descent = metrics.fontBoundingBoxDescent ?? fontSize * 0.2;
    const text = element.textContent ?? '';
    const drawSpacedText = (startX: number, baseline: number) => {
        let x = startX;
        for (const char of text) {
            ctx.fillText(char, x, baseline);
            x += ctx.measureText(char).width + letterSpacing;
        }
    };
    const left = rect.left - originX;
    const top = rect.top - originY;

    if (!style.writingMode.startsWith('vertical')) {
        const paddingLeft = parseFloat(style.paddingLeft) || 0;
        drawSpacedText(left + paddingLeft, top + (rect.height - (ascent + descent)) / 2 + ascent);
        return;
    }
    const lineHeight = rect.width;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    ctx.save();
    ctx.translate(left + lineHeight / 2, top + paddingTop);
    ctx.rotate(Math.PI / 2);
    drawSpacedText(0, -lineHeight / 2 + (lineHeight - (ascent + descent)) / 2 + ascent);
    ctx.restore();
};

const drawPassPhoto = (ctx: CanvasRenderingContext2D, pass: HTMLElement, photo: HTMLImageElement) => {
    const photoElement = pass.querySelector('img')!;
    const passRect = pass.getBoundingClientRect();
    const photoRect = photoElement.getBoundingClientRect();
    const boxX = photoRect.left - passRect.left;
    const boxY = photoRect.top - passRect.top;
    const positionY = parsePercent(getComputedStyle(photoElement).objectPosition.split(' ')[1] ?? '', 0.5);
    const { naturalWidth, naturalHeight } = photo;

    const [padX, padY, padWidth, padHeight] = coverRect(
        naturalWidth,
        naturalHeight,
        photoRect.width + 2 * BLUR_PAD,
        photoRect.height + 2 * BLUR_PAD,
        positionY,
    );
    ctx.drawImage(photo, boxX - BLUR_PAD + padX, boxY - BLUR_PAD + padY, padWidth, padHeight);

    const [x, y, width, height] = coverRect(naturalWidth, naturalHeight, photoRect.width, photoRect.height, positionY);
    ctx.drawImage(photo, boxX + x, boxY + y, width, height);
};

const createShadeGradient = (ctx: CanvasRenderingContext2D, passHeight: number) => {
    const shade = ctx.createLinearGradient(0, 0, 0, passHeight);
    for (const { percent, color } of DAY_PASS_SHADE_STOPS) shade.addColorStop(percent / 100, color);
    return shade;
};

/** 블러가 닿는 옆면 주변만 배율 1로 그린다 — 패스 전체를 그리면 저사양 기기에서 굽는 시간이 길어진다 */
const drawBackdrop = (pass: HTMLElement, photo: HTMLImageElement | null, stubLeft: number) => {
    const { width: passWidth, height: passHeight } = pass.getBoundingClientRect();
    const originX = stubLeft - BLUR_PAD;
    const { canvas, ctx } = createCanvas(
        Math.ceil(passWidth - originX + BLUR_PAD),
        Math.ceil(passHeight + 2 * BLUR_PAD),
    );
    const fillAll = () => ctx.fillRect(originX, -BLUR_PAD, canvas.width, canvas.height);
    ctx.translate(-originX, BLUR_PAD);
    ctx.fillStyle = BACKDROP_FALLBACK_COLOR;
    fillAll();

    if (photo) {
        drawPassPhoto(ctx, pass, photo);
    } else {
        const fallbackGradient = parseLinearGradient(getComputedStyle(pass).backgroundImage);
        if (fallbackGradient) {
            try {
                ctx.fillStyle = createCanvasLinearGradient(ctx, fallbackGradient, {
                    x: 0,
                    y: 0,
                    width: passWidth,
                    height: passHeight,
                });
            } catch {
                ctx.fillStyle = BACKDROP_FALLBACK_COLOR;
            }
            fillAll();
        }
    }

    ctx.fillStyle = createShadeGradient(ctx, passHeight);
    fillAll();
    return canvas;
};

const drawBlurredBackdrop = (ctx: CanvasRenderingContext2D, backdrop: HTMLCanvasElement, scale: number) => {
    const width = backdrop.width * scale;
    const height = backdrop.height * scale;
    const offset = -BLUR_PAD * scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (typeof ctx.filter === 'string') {
        ctx.filter = `blur(${DAY_PASS_STUB.blurPx * scale}px) saturate(${DAY_PASS_STUB.saturate})`;
        ctx.drawImage(backdrop, offset, offset, width, height);
        ctx.filter = 'none';
    } else {
        const small = createCanvas(
            Math.max(1, Math.round(backdrop.width / SOFTWARE_BLUR_DOWNSCALE)),
            Math.max(1, Math.round(backdrop.height / SOFTWARE_BLUR_DOWNSCALE)),
        );
        small.ctx.imageSmoothingQuality = 'high';
        small.ctx.drawImage(backdrop, 0, 0, small.canvas.width, small.canvas.height);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(small.canvas, offset, offset, width, height);
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
};

const drawPerforation = (ctx: CanvasRenderingContext2D, height: number) => {
    const { perforationColor, perforationWidth, perforationDash, perforationPeriod } = DAY_PASS_STUB;
    ctx.fillStyle = perforationColor;
    for (let y = 0; y < height; y += perforationPeriod) {
        ctx.fillRect(0, y, perforationWidth, Math.min(perforationDash, height - y));
    }
};

const drawStubText = (ctx: CanvasRenderingContext2D, stub: HTMLElement) => {
    const stubRect = stub.getBoundingClientRect();
    for (const element of Array.from(stub.querySelectorAll('*'))) {
        if (element.childElementCount === 0) drawTextElement(ctx, element, stubRect.left, stubRect.top);
    }
};

const punchNotches = (ctx: CanvasRenderingContext2D, height: number) => {
    const { notchOffsetX, notchRadius } = DAY_PASS_STUB;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(notchOffsetX, 0, notchRadius, 0, Math.PI * 2);
    ctx.moveTo(notchOffsetX + notchRadius, height);
    ctx.arc(notchOffsetX, height, notchRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
};

const drawFace = (
    layers: readonly StubLayer[],
    stub: HTMLElement,
    backdrop: HTMLCanvasElement,
    size: { width: number; height: number; scale: number },
) => {
    const { width, height, scale } = size;
    const { canvas, ctx } = createCanvas(Math.round(width * scale), Math.round(height * scale));
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.save();
    traceRightRoundedRect(ctx, width, height, TICKET_RADIUS);
    ctx.clip();
    for (const layer of layers) {
        switch (layer) {
            case 'backdrop':
                drawBlurredBackdrop(ctx, backdrop, scale);
                break;
            case 'glass':
                ctx.fillStyle = DAY_PASS_STUB.glassColor;
                ctx.fillRect(0, 0, width, height);
                break;
            case 'highlight':
                ctx.fillStyle = DAY_PASS_STUB.highlightColor;
                ctx.fillRect(DAY_PASS_STUB.perforationWidth, 0, 1, height);
                break;
            case 'perforation':
                drawPerforation(ctx, height);
                break;
            case 'text':
                drawStubText(ctx, stub);
                break;
        }
    }
    ctx.restore();
    punchNotches(ctx, height);
    return canvas;
};

/** photo는 crossOrigin으로 받은 이미지여야 텍스처 업로드가 막히지 않는다 */
export const bakeStub = (stub: HTMLElement, photo: HTMLImageElement | null): BakedStub => {
    const pass = stub.parentElement!;
    const passRect = pass.getBoundingClientRect();
    const stubRect = stub.getBoundingClientRect();
    const size = {
        width: stubRect.width,
        height: passRect.height,
        scale: Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_BAKE_SCALE),
    };
    const backdrop = drawBackdrop(pass, photo, stubRect.left - passRect.left);
    return {
        front: drawFace(STUB_LAYERS.front, stub, backdrop, size),
        back: drawFace(STUB_LAYERS.back, stub, backdrop, size),
        width: size.width,
        height: size.height,
    };
};
