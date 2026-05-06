import { css } from '@emotion/react';

/**
 * 지도 위에 렌더되는 시네마틱 비네팅 오버레이.
 * pointer-events: none 이므로 지도 인터랙션을 가리지 않는다.
 * prefers-reduced-motion 환경에서는 표시하지 않는다.
 */
const MapVignette = () => (
    <div css={vignetteStyle} aria-hidden="true" />
);

const vignetteStyle = css`
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    background: radial-gradient(
        ellipse at 50% 50%,
        transparent 40%,
        rgba(0, 0, 0, 0.45) 100%
    );

    @media (prefers-reduced-motion: reduce) {
        display: none;
    }
`;

export default MapVignette;
