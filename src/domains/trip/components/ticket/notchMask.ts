import { css } from '@emotion/react';

type NotchCenter = [x: string, y: string];

// mask는 자기 box-shadow까지 자르므로 그림자는 바깥 요소에 둔다
export const notchMask = (radius: number, centers: NotchCenter[]) => {
    const holeLayers = centers
        .map(
            ([x, y]) =>
                `radial-gradient(circle ${radius}px at ${x} ${y}, transparent ${radius - 0.5}px, #000 ${radius}px)`,
        )
        .join(', ');
    return css`
        -webkit-mask: ${holeLayers};
        mask: ${holeLayers};
        -webkit-mask-composite: source-in;
        mask-composite: intersect;
    `;
};
