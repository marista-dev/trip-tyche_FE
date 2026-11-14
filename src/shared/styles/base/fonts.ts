import { css } from '@emotion/react';

import digitalBoldItalic from '@/assets/fonts/DS-Digital-BoldItalic.woff';

const fontStyles = css`
    @font-face {
        font-family: 'DS-DIGII';
        src: url(${digitalBoldItalic}) format('woff');
        font-weight: bold;
        font-style: italic;
        /* 글꼴을 받는 동안 글자를 숨기지 않고 기본 글꼴로 먼저 보여 준다 */
        font-display: swap;
    }
`;

export default fontStyles;
