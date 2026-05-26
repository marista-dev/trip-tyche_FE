import { useEffect } from 'react';

import { css } from '@emotion/react';
import { Outlet } from 'react-router-dom';

import WebSocketBanner from '@/domains/notification/banner/WebSocketBanner';
import useUserStore from '@/domains/user/stores/useUserStore';
import { socket } from '@/libs/socket';
import Toast from '@/shared/components/common/Toast';
import theme from '@/shared/styles/theme';

const RootLayout = () => {
    const { connect, disconnect } = socket;

    const userId = useUserStore((s) => s.userInfo?.userId);

    useEffect(() => {
        if (userId) {
            connect(String(userId));
        }
        return () => {
            disconnect();
        };
    }, [userId, connect, disconnect]);

    return (
        <div css={container}>
            <Outlet />
            <Toast />
            <WebSocketBanner />
        </div>
    );
};

const container = css`
    max-width: 428px;
    height: 100dvh;
    margin: 0 auto;
    background-color: ${theme.COLORS.BACKGROUND.WHITE};
`;

export default RootLayout;
