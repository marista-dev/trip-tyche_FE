/** t: 0~1 범위의 진행률 → 이징 적용 후 0~1 반환 */

export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** 도착 시 줌·틸트 보간에 사용 — 빠르게 감속 */
export const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);
