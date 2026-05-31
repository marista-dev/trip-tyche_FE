import { css } from '@emotion/react';

import { scrollbarStyles } from '@/shared/styles/base/scrollbar';
import theme from '@/shared/styles/theme';

export const baseStyles = css`
    *,
    *::before,
    *::after {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        ${scrollbarStyles}
    }

    body {
        font-family:
            'SF Pro Text', 'SF Pro Display', 'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', 'Helvetica Neue',
            Helvetica, Arial, sans-serif;
        font-weight: 400;
        line-height: 1.47;
        letter-spacing: -0.3px;
        font-size: 15px;
        color: #0f172a;
        background-color: #f8fafc;
        overflow: hidden;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }

    input,
    textarea {
        font-family:
            'SF Pro Text', 'SF Pro Display', 'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', 'Helvetica Neue',
            Helvetica, Arial, sans-serif;
        color: ${theme.COLORS.TEXT.BLACK};

        &::placeholder {
            color: ${theme.COLORS.TEXT.DESCRIPTION_LIGHT};
            opacity: 1;
        }
    }

    .wrapper {
        background-color: ${theme.COLORS.BACKGROUND.WHITE};
        padding: 0 16px;
    }

    button:focus-visible,
    a:focus-visible,
    input:focus-visible,
    select:focus-visible,
    textarea:focus-visible,
    [tabindex]:focus-visible {
        outline: none;
        box-shadow: ${theme.COLORS.BOX_SHADOW.INPUT_FOCUS};
    }
`;
