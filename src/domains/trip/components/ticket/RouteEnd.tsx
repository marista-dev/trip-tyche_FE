import { css } from '@emotion/react';

import { RoutePoint } from '@/domains/trip/destinations';

interface RouteEndProps {
    point: RoutePoint;
    side: 'from' | 'to';
    /** 공항 코드 글자 크기(px). 지명은 이보다 1px 작게 쓴다 */
    size?: number;
}

/** 탑승권 경로의 한쪽 끝. 해외는 공항 코드, 국내는 지명 + 영문 보조 표기. */
const RouteEnd = ({ point, side, size = 22 }: RouteEndProps) => {
    const isRight = side === 'to';

    if (point.isCode) {
        return <div css={[codeStyle(size), isRight && rightText]}>{point.label}</div>;
    }

    // 국내 출발('국내')은 도착지보다 한 톤 낮춘다
    const muted = side === 'from';
    return (
        <div css={[placeWrap, isRight && placeWrapRight]}>
            <span css={[placeLabel(size - 1), muted && placeLabelMuted]}>{point.label}</span>
            {point.sub && <span css={placeSub}>{point.sub}</span>}
        </div>
    );
};

const codeStyle = (size: number) => css`
    font-size: ${size}px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1;
    color: #fff;
    flex-shrink: 0;
`;

const rightText = css`
    text-align: right;
`;

const placeWrap = css`
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex-shrink: 0;
    color: #fff;
`;

const placeWrapRight = css`
    align-items: flex-end;
`;

const placeLabel = (size: number) => css`
    font-size: ${size}px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1;
`;

const placeLabelMuted = css`
    font-size: 15px;
    color: rgba(255, 255, 255, 0.7);
`;

const placeSub = css`
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 1.5px;
    line-height: 1;
    color: rgba(255, 255, 255, 0.5);
`;

export default RouteEnd;
