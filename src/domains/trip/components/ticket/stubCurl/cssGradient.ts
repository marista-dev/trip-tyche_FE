export interface GradientStop {
    color: string;
    /** 0~1 */
    at: number;
}

export interface ParsedGradient {
    angleDeg: number;
    stops: GradientStop[];
}

const DEFAULT_ANGLE_DEG = 180;

const splitTopLevelCommas = (value: string) => {
    const parts: string[] = [];
    let depth = 0;
    let partStart = 0;
    for (let i = 0; i < value.length; i++) {
        if (value[i] === '(') depth++;
        else if (value[i] === ')') depth--;
        else if (value[i] === ',' && depth === 0) {
            parts.push(value.slice(partStart, i).trim());
            partStart = i + 1;
        }
    }
    parts.push(value.slice(partStart).trim());
    return parts;
};

/** 각도형 linear-gradient만 읽는다. 그 밖의 형식은 null */
export const parseLinearGradient = (value: string): ParsedGradient | null => {
    const match = /^linear-gradient\((.*)\)$/s.exec(value.trim());
    if (!match) return null;
    const parts = splitTopLevelCommas(match[1]);
    let angleDeg = DEFAULT_ANGLE_DEG;
    if (/^-?[\d.]+deg$/.test(parts[0])) angleDeg = parseFloat(parts.shift()!);
    else if (parts[0].startsWith('to ')) return null;
    if (parts.length < 2) return null;
    const stops = parts.map((part, index) => {
        const position = /\s(-?[\d.]+)%$/.exec(part);
        return {
            color: position ? part.slice(0, position.index).trim() : part,
            at: position ? parseFloat(position[1]) / 100 : index / (parts.length - 1),
        };
    });
    return { angleDeg, stops };
};

/** CSS 각도(0deg=위쪽, 시계 방향)를 상자 기준 캔버스 그라디언트로. 캔버스가 모르는 색이면 던진다 */
export const createCanvasLinearGradient = (
    ctx: CanvasRenderingContext2D,
    gradient: ParsedGradient,
    box: { x: number; y: number; width: number; height: number },
) => {
    const angle = (gradient.angleDeg * Math.PI) / 180;
    const dirX = Math.sin(angle);
    const dirY = -Math.cos(angle);
    const halfLength = (Math.abs(box.width * dirX) + Math.abs(box.height * dirY)) / 2;
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const canvasGradient = ctx.createLinearGradient(
        centerX - dirX * halfLength,
        centerY - dirY * halfLength,
        centerX + dirX * halfLength,
        centerY + dirY * halfLength,
    );
    for (const stop of gradient.stops) {
        canvasGradient.addColorStop(Math.min(1, Math.max(0, stop.at)), stop.color);
    }
    return canvasGradient;
};
