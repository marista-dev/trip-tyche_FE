/* 지구본 위에 겹치는 글자 요소: 상단 헤더 · 하단 힌트 · 로딩 표시 */
import { css, keyframes } from '@emotion/react';

import { COLORS } from '@/shared/constants/style';

const { ACCENT } = COLORS;

export type GlobeContentState = 'empty' | 'populated';

interface GlobeHeaderProps {
    state: GlobeContentState;
    countryCount: number;
    nickname: string;
}

/** populated: 방문 나라 수, empty: 환영 인사 */
export const GlobeHeader = ({ state, countryCount, nickname }: GlobeHeaderProps) => (
    <div css={editorialHeader}>
        {state === 'populated' ? (
            <div css={countryDisplay}>
                <span css={countryNum}>{countryCount}</span>
                <div css={countryLabels}>
                    <span css={eyebrow}>COUNTRIES</span>
                    <span css={visitedLabel}>방문한 지역</span>
                </div>
            </div>
        ) : (
            <div css={welcomeDisplay}>
                <span css={eyebrow}>WELCOME</span>
                <span css={welcomeName}>{nickname ? `${nickname}님` : '안녕하세요'}</span>
            </div>
        )}
    </div>
);

export const GlobeHint = ({ state }: { state: GlobeContentState }) => (
    <div css={hintPill}>
        <div css={hintPillInner}>
            {state === 'populated' && <span css={hintDot} />}
            <span css={hintText}>
                {state === 'empty' ? '지구본을 돌려보세요' : '핀을 탭하거나 지구본을 돌려보세요'}
            </span>
        </div>
    </div>
);

export const GlobeLoading = () => (
    <div css={loadingWrap}>
        <div css={loadingOrb} />
        <p css={loadingText}>지구본 로딩 중</p>
    </div>
);

const fadeIn = keyframes`
    from { opacity: 0; }
    to   { opacity: 1; }
`;

const orbPulse = keyframes`
    0%, 100% { opacity: 0.5; transform: scale(1);   }
    50%       { opacity: 1;   transform: scale(1.5); }
`;

/* editorial header */
const editorialHeader = css`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    padding: 54px 24px 0;
    z-index: 40;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    pointer-events: none;
    animation: ${fadeIn} 0.5s ease both;
`;

const countryDisplay = css`
    display: flex;
    align-items: flex-end;
    gap: 10px;
`;

const countryNum = css`
    font-size: 44px;
    font-weight: 800;
    color: #111827;
    letter-spacing: -1.5px;
    line-height: 1;
    font-family: 'Outfit', sans-serif;
`;

const countryLabels = css`
    padding-bottom: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

/** COUNTRIES · WELCOME 같은 작은 대문자 라벨 */
const eyebrow = css`
    font-size: 11px;
    font-weight: 600;
    color: #9ca3af;
    letter-spacing: 1.5px;
    text-transform: uppercase;
`;

const visitedLabel = css`
    font-size: 12px;
    font-weight: 500;
    color: #374151;
`;

const welcomeDisplay = css`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const welcomeName = css`
    font-size: 22px;
    font-weight: 700;
    color: #111827;
    letter-spacing: -0.5px;
`;

/* hint pill */
const hintPill = css`
    position: absolute;
    bottom: 44px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    z-index: 10;
    pointer-events: none;
    animation: ${fadeIn} 0.4s ease both;
`;

const hintPillInner = css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 100px;
    border: 1px solid rgba(0, 0, 0, 0.04);
`;

const hintDot = css`
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: ${ACCENT};
    flex-shrink: 0;
`;

const hintText = css`
    font-size: 11px;
    font-weight: 500;
    color: #6b7280;
    letter-spacing: -0.2px;
`;

/* loading */
const loadingWrap = css`
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    z-index: 10;
    pointer-events: none;
`;

const loadingOrb = css`
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${ACCENT};
    animation: ${orbPulse} 1.4s ease-in-out infinite;
`;

const loadingText = css`
    font-size: 12px;
    font-weight: 500;
    color: #9ca3af;
    letter-spacing: 0.3px;
`;
