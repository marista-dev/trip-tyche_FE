import { css } from '@emotion/react';

import { scrollbarStyles } from '@/shared/styles/base/scrollbar';
import theme from '@/shared/styles/theme';

export const baseStyles = css`
    /*
     * safe area. Android edge-to-edge(targetSdk 35+)에서 WebView가 상태바·제스처 바 밑까지 그려지므로
     * 화면 위·아래에 붙는 UI는 이 값만큼 띄워야 한다. 구형 Android WebView(<140)는 env()가 0이라
     * Capacitor SystemBars가 주입하는 --safe-area-inset-*을 우선 쓴다.
     */
    :root {
        --app-safe-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
        --app-safe-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
    }

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
