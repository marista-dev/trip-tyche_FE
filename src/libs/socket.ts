import { Client } from '@stomp/stompjs';

import { BannerType } from '@/domains/notification/banner/types';
import { useBannerStore } from '@/domains/notification/banner/useBannerStore';
import { isNative } from '@/platform';
import { getAccessToken } from '@/platform/native/auth';
import { SOCKET_URL } from '@/shared/constants/socket';
import { queryClient } from '@/shared/providers/TanStackProvider';

const state = {
    userId: null as string | null,
    client: null as Client | null,
    isConnected: false,
    unReadNotificationCount: null as number | null,
};

const connectListeners = new Set<() => void>();

export const getStompClient = (): Client | null => state.client;

export const isStompConnected = (): boolean => state.isConnected;

export const addStompConnectListener = (listener: () => void): (() => void) => {
    connectListeners.add(listener);
    if (state.isConnected) {
        listener();
    }
    return () => connectListeners.delete(listener);
};

/*
 * 웹은 WebSocket handshake에 쿠키가 자동으로 실려 인증되지만, 앱은 쿠키가 없다.
 * handshake는 커스텀 헤더를 실을 수 없어 백엔드가 ?token= 쿼리 파라미터를 지원한다.
 * (JWTAuthenticationFilter가 헤더 → 쿠키 → 쿼리 순으로 토큰을 찾는다)
 */
const buildBrokerUrl = (): string => {
    if (!isNative()) return SOCKET_URL.BASE;

    const accessToken = getAccessToken();
    return accessToken ? `${SOCKET_URL.BASE}?token=${encodeURIComponent(accessToken)}` : SOCKET_URL.BASE;
};

const connect = (userId: string) => {
    if (state.client && state.isConnected && state.userId === userId) {
        return state.client;
    }
    console.log('[socket] connect()', { userId, path: location.pathname, t: Date.now() });
    state.userId = userId;

    const client = new Client({
        brokerURL: buildBrokerUrl(),
        reconnectDelay: 5000,
        heartbeatIncoming: 25000,
        heartbeatOutgoing: 25000,
    });

    client.onConnect = () => {
        console.log('[socket] CONNECTED', { path: location.pathname, t: Date.now() });
        state.isConnected = true;
        subscribeToShareNotifications(userId);
        connectListeners.forEach((listener) => {
            try {
                listener();
            } catch (err) {
                console.error('[stomp] connect listener error', err);
            }
        });
    };

    client.onStompError = (frame) => {
        console.error('ws-stomp-error', frame.headers['message']);
    };

    client.onWebSocketClose = () => {
        state.isConnected = false;
    };

    state.client = client;
    client.activate();
};

const disconnect = (): void => {
    if (state.client) {
        if (state.client.active) {
            state.client.deactivate();
        }
        state.client = null;
    }
    state.isConnected = false;
    state.userId = null;
};

const subscribeToShareNotifications = (userId: string) => {
    if (!state.client) return;

    state.client.subscribe(SOCKET_URL.TOPIC.REQUEST(userId), async (message) => {
        try {
            const subscribedMessage = JSON.parse(message.body);
            const messageType = subscribedMessage.type as BannerType;

            useBannerStore.getState().show({
                type: messageType,
                senderNickname: subscribedMessage.senderNickname,
                tripTitle: subscribedMessage.tripTitle,
                tripKey: subscribedMessage.tripKey,
                shareId: subscribedMessage.shareId,
                notificationId: subscribedMessage.notificationId,
                count: subscribedMessage.count,
            });

            if (messageType === 'SHARED_REQUEST') {
                // summary/notification 즉시 무효화 생략 — 배너 응답 후 NotificationPage 진입 시 자연 갱신
                return;
            }

            if (messageType === 'SHARED_APPROVE') {
                queryClient.invalidateQueries({ queryKey: ['ticket-list'] });
                queryClient.invalidateQueries({ queryKey: ['share'] });
            }

            queryClient.invalidateQueries({ queryKey: ['summary'] });
            queryClient.invalidateQueries({ queryKey: ['notification'] });

            if (messageType.startsWith('TRIP')) {
                await queryClient.invalidateQueries({ queryKey: ['ticket-list'] });
                await queryClient.invalidateQueries({ queryKey: ['ticket-info'] });
            }

            if (messageType.startsWith('MEDIA')) {
                queryClient.invalidateQueries({ queryKey: ['trip-images', subscribedMessage.tripKey] });
            }
        } catch (error) {
            console.error('메시지 처리 오류:', error);
        }
    });
};

// const requestUnReadNotificationCount = (userId: string) => {
//     if (!state.client || !state.isConnected) return;

//     state.client.publish({
//         destination: SOCKET_URL.TOPIC.UNREAD,
//         body: JSON.stringify({
//             recipientId: userId,
//         }),
//     });
// };

export const socket = {
    get isConnected() {
        return state.isConnected;
    },
    connect,
    disconnect,
};
