import { css } from '@emotion/react';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';

/**
 * 사진 관리 영역의 모든 페이지가 공유하는 풀스크린 세로 레이아웃.
 * - height: 100dvh (글로벌 body { overflow: hidden } 환경에서 자체 스크롤 보장)
 * - display: flex column (헤더 sticky + 내부 main의 flex:1 overflow-y:auto 패턴 전제)
 * - 디자인 토큰의 배경/폰트 일관 적용
 */
export const managePageContainerStyle = css`
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: ${MANAGE_TOKENS.bg};
    color: ${MANAGE_TOKENS.text.primary};
    font-family: ${MANAGE_TOKENS.font};
`;

/**
 * 사진 관리 영역에서 스크롤 가능한 본문 컨테이너.
 * - flex:1로 헤더/하단고정 영역 사이를 채움
 * - overflow-y: auto + iOS momentum scrolling + overscroll contain
 * - padding은 페이지마다 다르면 customPadding으로 오버라이드
 */
export const manageScrollableBodyStyle = css`
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 12px 16px 32px;
`;
