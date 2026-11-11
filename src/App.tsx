import { ThemeProvider } from '@emotion/react';
import { createTheme, MantineProvider } from '@mantine/core';
import { RouterProvider } from 'react-router-dom';

import AuthProvider from '@/domains/user/components/AuthProvider';
import router from '@/router/Router';
import { FONT_FAMILY } from '@/shared/constants/style';
import TanStackProvider from '@/shared/providers/TanStackProvider';
import GlobalStyle from '@/shared/styles/GlobalStyle';
import GoogleAutoCompleteStyle from '@/shared/styles/GoogleAutoCompleteStyle';
import theme from '@/shared/styles/theme';

import '@mantine/dates/styles.css';
import '@mantine/core/styles.css';

// 지정하지 않으면 Mantine 기본 폰트(-apple-system)가 섞인다.
const mantineTheme = createTheme({ fontFamily: FONT_FAMILY, headings: { fontFamily: FONT_FAMILY } });

const App = () => {
    return (
        <TanStackProvider>
            <MantineProvider theme={mantineTheme}>
                <ThemeProvider theme={theme}>
                    <GlobalStyle />
                    <GoogleAutoCompleteStyle />
                    <AuthProvider>
                        <RouterProvider router={router} />
                    </AuthProvider>
                </ThemeProvider>
            </MantineProvider>
        </TanStackProvider>
    );
};

export default App;
