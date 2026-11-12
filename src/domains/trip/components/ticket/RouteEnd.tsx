import { css } from '@emotion/react';

import { RoutePoint } from '@/domains/trip/destinations';

interface RouteEndProps {
    point: RoutePoint;
    side: 'from' | 'to';
    codeFontSize?: number;
}

const RouteEnd = ({ point, side, codeFontSize = 22 }: RouteEndProps) => {
    const isArrival = side === 'to';

    if (point.isCode) {
        return <div css={[airportCode(codeFontSize), isArrival && alignRight]}>{point.label}</div>;
    }

    return (
        <div css={[placeName, isArrival && placeNameRight]}>
            <span css={[placeLabel(codeFontSize - 1), !isArrival && departureLabel]}>{point.label}</span>
            {point.sub && <span css={placeSubLabel}>{point.sub}</span>}
        </div>
    );
};

const airportCode = (fontSize: number) => css`
    font-size: ${fontSize}px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1;
    color: #fff;
    flex-shrink: 0;
`;

const alignRight = css`
    text-align: right;
`;

const placeName = css`
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex-shrink: 0;
    color: #fff;
`;

const placeNameRight = css`
    align-items: flex-end;
`;

const placeLabel = (fontSize: number) => css`
    font-size: ${fontSize}px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1;
`;

const departureLabel = css`
    font-size: 15px;
    color: rgba(255, 255, 255, 0.7);
`;

const placeSubLabel = css`
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 1.5px;
    line-height: 1;
    color: rgba(255, 255, 255, 0.5);
`;

export default RouteEnd;
