import { css } from '@emotion/react';

import { BANNER_DESIGN, BANNER_ICON } from './constants';
import { BannerType } from './types';

interface IconCircleProps {
    type: BannerType;
}

const IconCircle: React.FC<IconCircleProps> = ({ type }) => {
    const Icon = BANNER_ICON[type];
    return (
        <div css={wrap}>
            <Icon size={BANNER_DESIGN.icon.svgSize} strokeWidth={2} />
        </div>
    );
};

const wrap = css`
    width: ${BANNER_DESIGN.icon.size}px;
    height: ${BANNER_DESIGN.icon.size}px;
    border-radius: 50%;
    background: ${BANNER_DESIGN.icon.background};
    color: ${BANNER_DESIGN.icon.color};
    display: grid;
    place-items: center;
    flex-shrink: 0;
`;

export default IconCircle;
