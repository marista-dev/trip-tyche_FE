import { css } from '@emotion/react';

import { DAY_PASS_STUB } from '@/domains/trip/components/ticket/ticketGeometry';

// 옆면 폭만큼 왼쪽으로 넓혀 사진 중심이 옆면을 뺀 영역의 가운데에 오게 한다
export const ticketPhoto = css`
    position: absolute;
    top: 0;
    left: -${DAY_PASS_STUB.width}px;
    width: calc(100% + ${DAY_PASS_STUB.width}px);
    height: 100%;
    object-fit: cover;
    object-position: center 35%;
`;
