/** 오빗 링 배치 계산. Three.js에 의존하지 않는 순수 함수라 단위 테스트한다. */

/** 이보다 많으면 카드를 줄이고 텍스처 해상도도 낮춘다 */
export const MANY_TICKETS = 6;

export interface RingLayout {
    /** 카드 폭(월드 단위) */
    cardWidth: number;
    /** 링 반지름. 1장이면 0(링 없이 정면) */
    radius: number;
    /** 카드 사이 각도(rad) */
    step: number;
}

export const getRingLayout = (count: number): RingLayout => {
    const cardWidth = count > MANY_TICKETS ? 0.48 : 0.54;
    const step = count > 0 ? (Math.PI * 2) / count : 0;
    let radius: number;
    if (count <= 1) radius = 0;
    // 2장은 앞뒤로 마주 보게 — 둘레 공식으로는 지나치게 작아진다
    else if (count === 2) radius = 0.34;
    else radius = Math.max(0.42, (count * cardWidth * 1.06) / (Math.PI * 2));
    return { cardWidth, radius, step };
};

export const mod = (a: number, n: number) => ((a % n) + n) % n;

/** 링 회전값에서 정면에 온 카드 인덱스 */
export const activeIndexOf = (rotation: number, step: number, count: number) =>
    count > 0 && step > 0 ? mod(Math.round(rotation / step), count) : 0;

/**
 * 인덱스 index의 카드를 정면으로 가져오는 회전 칸 수(정수 k, 실제 회전 = k * step).
 * 현재 칸(current)에서 가장 가까운 방향으로 돈다.
 */
export const nearestTurnTo = (current: number, index: number, count: number) => {
    let best = current;
    let bestDistance = Infinity;
    for (let k = current - count; k <= current + count; k++) {
        if (mod(k, count) !== index) continue;
        const distance = Math.abs(k - current);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = k;
        }
    }
    return best;
};

/** 드래그를 놓았을 때 관성을 반영해 멈출 칸 */
export const snapTurn = (rotation: number, velocityRadPerMs: number, step: number) =>
    Math.round((rotation - velocityRadPerMs * 250) / step);
