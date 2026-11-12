import { css } from '@emotion/react';

/**
 * 절취선 반원 구멍을 mask로 실제로 뚫는다 — 색을 칠한 점이 아니라서 어떤 페이지 배경 위에서도 그대로 비친다.
 * 구멍마다 "구멍만 투명한" 층을 겹쳐 교집합(intersect)을 남긴다. 중심은 CSS 위치 값(예: 'calc(100% - 81px)').
 * box-shadow는 mask를 따라가지 않으므로 그림자는 바깥 요소의 filter: drop-shadow로 준다.
 */
export const notchMask = (radius: number, centers: [x: string, y: string][]) => {
    const layers = centers
        .map(
            ([x, y]) =>
                `radial-gradient(circle ${radius}px at ${x} ${y}, transparent ${radius - 0.5}px, #000 ${radius}px)`,
        )
        .join(', ');
    return css`
        -webkit-mask: ${layers};
        mask: ${layers};
        -webkit-mask-composite: source-in;
        mask-composite: intersect;
    `;
};
