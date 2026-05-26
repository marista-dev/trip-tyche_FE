import { css } from '@emotion/react';
import { Plane } from 'lucide-react';

import { BANNER_DESIGN } from './constants';

interface BoardingPassPreviewProps {
    tripTitle?: string;
}

const BoardingPassPreview: React.FC<BoardingPassPreviewProps> = ({ tripTitle }) => {
    return (
        <div css={card}>
            <div css={label}>TYCHE AIR · BOARDING</div>
            <div css={title}>{tripTitle || '여행 티켓'}</div>
            <div css={routeRow}>
                <span css={airport}>ICN</span>
                <div css={dashes} />
                <Plane size={13} color='#fff' fill='#fff' />
                <div css={dashes} />
                <span css={airport}>NRT</span>
            </div>
        </div>
    );
};

const card = css`
    background: ${BANNER_DESIGN.boarding.background};
    border-radius: ${BANNER_DESIGN.boarding.radius}px;
    padding: ${BANNER_DESIGN.boarding.padding}px;
    color: #fff;
`;

const label = css`
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 6px;
`;

const title = css`
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.3px;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const routeRow = css`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
`;

const airport = css`
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.04em;
`;

const dashes = css`
    flex: 1;
    height: 1px;
    background: repeating-linear-gradient(to right, rgba(255, 255, 255, 0.4) 0 3px, transparent 3px 7px);
`;

export default BoardingPassPreview;
