import { Client } from '@stomp/stompjs';

import { BannerType } from '@/domains/notification/banner/types';
import { useBannerStore } from '@/domains/notification/banner/useBannerStore';
import { SOCKET_URL } from '@/shared/constants/socket';
import { queryClient } from '@/shared/providers/TanStackProvider';

const state = {
    userId: null as string | null,
    client: null as Client | null,
    isConnected: false,
    unReadNotificationCount: null as number | null,
};

const connect = (userId: string) => {
    if (state.client && state.isConnected && state.userId === userId) {
        return state.client;
    }
    console.log('[socket] connect()', { userId, path: location.pathname, t: Date.now() });
    state.userId = userId;

    const client = new Client({
        brokerURL: `${SOCKET_URL.BASE}`,
        reconnectDelay: 5000,
        heartbeatIncoming: 25000,
        heartbeatOutgoing: 25000,
    });

    client.onConnect = () => {
        console.log('[socket] CONNECTED', { path: location.pathname, t: Date.now() });
        state.isConnected = true;
        subscribeToShareNotifications(userId);
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
