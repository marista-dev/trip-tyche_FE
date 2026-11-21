import { Client } from '@stomp/stompjs';

import { invalidateTripMedia } from '@/domains/media/queryKeys';
import { BannerType } from '@/domains/notification/banner/types';
import { useBannerStore } from '@/domains/notification/banner/useBannerStore';
import { notificationKeys } from '@/domains/notification/queryKeys';
import { routeKeys } from '@/domains/route/queryKeys';
import { shareKeys } from '@/domains/share/queryKeys';
import { invalidateTripLists, tripKeys } from '@/domains/trip/queryKeys';
import { SUMMARY_QUERY_KEY } from '@/domains/user/queryKeys';
import { type RefreshResult } from '@/libs/apis/shared/tokenRefresh';
import { isNative } from '@/platform';
import { getAccessToken, refreshAccessTokenResult } from '@/platform/native/auth';
import { SOCKET_URL } from '@/shared/constants/socket';
import { queryClient } from '@/shared/providers/TanStackProvider';

const state = {
    userId: null as string | null,
    client: null as Client | null,
    isConnected: false,
    unReadNotificationCount: null as number | null,
    // 연속으로 일시 실패한 토큰 갱신 횟수. 연결에 성공하거나 갱신이 성공하면 0으로 돌아간다
    refreshFailures: 0,
    // 이번 접속 시도에서 이미 실패를 셌는지. 한 시도 안의 갱신(beforeConnect, 이어지는 ERROR 처리)은 한 번만 센다
    failureCounted: false,
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
 * 앱은 STOMP CONNECT 프레임의 Authorization 헤더로 토큰을 보낸다(백엔드 StompConnectAuthInterceptor).
 * URL의 ?token=은 nginx·Cloudflare 접근 로그에 토큰이 그대로 남아 쓰지 않는다.
 * CONNECT 헤더가 없으면 서버가 handshake principal(웹 쿠키)을 쓰므로 웹은 헤더를 달지 않는다.
 */

// 만료 직전 토큰은 서버가 CONNECT를 거부하므로 여유를 두고 미리 갱신한다
const TOKEN_EXPIRY_MARGIN_MS = 30 * 1000;
const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_DELAY_MS = 60 * 1000;
// CONNECT 헤더의 토큰이 만료·변조일 때 서버가 ERROR 프레임 message에 싣는 값
const INVALID_TOKEN_MESSAGE = 'invalid token';

const isTokenExpiring = (token: string): boolean => {
    try {
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const { exp } = JSON.parse(atob(payload));
        return typeof exp === 'number' && exp * 1000 - Date.now() < TOKEN_EXPIRY_MARGIN_MS;
    } catch {
        // 해독할 수 없으면 만료로 단정하지 않고 서버 판정에 맡긴다
        return false;
    }
};

// beforeConnect가 던지면 stompjs가 재연결을 예약하지 않아 소켓이 영영 끊긴다. 예상 밖의 reject는 일시 실패로 본다
const tryRefreshToken = async (): Promise<RefreshResult> => {
    const result = await refreshAccessTokenResult().catch((): RefreshResult => 'transient');

    if (result !== 'transient') {
        state.refreshFailures = 0;
    } else if (!state.failureCounted) {
        // 같은 시도에서 beforeConnect와 ERROR 처리가 같은 실패를 겹쳐 세면 백오프가 두 배로 빨리 자란다
        state.refreshFailures += 1;
        state.failureCounted = true;
    }
    return result;
};

/*
 * 일시 실패(네트워크 오류·타임아웃·5xx)가 이어지면 재연결 간격을 늘린다: 5s → 10s → 20s → 40s → 60s(상한).
 * stompjs 7.1.1은 reconnectDelay를 activate() 때만 읽고, 내장 지수 백오프(reconnectTimeMode)는
 * 연결에 성공해도 간격을 되돌리지 않아 한 번 늘면 계속 상한에 머문다. 그래서 재연결 간격은 stompjs에 맡기고
 * (기본 5s), beforeConnect에서 모자란 만큼만 더 기다린다. 연결에 성공하면 처음 간격으로 돌아간다.
 */
const extraBackoffMs = (): number =>
    state.refreshFailures === 0
        ? 0
        : Math.min(MAX_RECONNECT_DELAY_MS, RECONNECT_DELAY_MS * 2 ** state.refreshFailures) - RECONNECT_DELAY_MS;

// 재연결마다 호출된다. 생성 시점의 토큰을 박아 두면 1시간 뒤 재연결이 만료 토큰을 다시 보낸다
const prepareConnectHeaders = async (client: Client): Promise<void> => {
    state.failureCounted = false;
    const backoff = extraBackoffMs();
    if (backoff > 0) {
        await new Promise((resolve) => setTimeout(resolve, backoff));
        // 기다리는 사이 disconnect되거나 새 클라이언트로 바뀌었으면 더 하지 않는다(stompjs도 inactive면 접속을 멈춘다)
        if (state.client !== client) return;
    }

    let token = getAccessToken();
    if (!token || isTokenExpiring(token)) {
        await tryRefreshToken();
        token = getAccessToken();
    }
    client.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
};

const recoverFromInvalidToken = async (client: Client): Promise<void> => {
    const result = await tryRefreshToken();
    // 갱신하는 사이 disconnect되거나 새 클라이언트로 바뀌었으면 건드리지 않는다
    if (state.client !== client) return;

    if (result === 'rejected') {
        // refresh 토큰이 없거나(게스트) 폐기돼 서버가 거절했다. 재연결해도 같은 오류만 반복되므로 멈춘다.
        // 로그아웃은 인증 흐름(HTTP 인터셉터)에 맡기고, 이후 로그인으로 connect()가 다시 불리면 새 클라이언트를 만든다
        disconnect();
        return;
    }

    // 갱신에 성공했거나 일시 실패(네트워크 등)다. 소켓은 살려 두고 stompjs 재연결에 맡긴다(일시 실패면 위의 백오프가 간격을 늘린다).
    // 서버가 ERROR 뒤에 소켓을 닫지 않으면 stompjs가 재연결을 시작하지 못하므로 소켓만 닫아 준다
    if (!client.connected) client.forceDisconnect();
};

const connect = (userId: string) => {
    if (state.client && state.isConnected && state.userId === userId) {
        return state.client;
    }
    console.log('[socket] connect()', { userId, path: location.pathname, t: Date.now() });
    state.userId = userId;

    const client = new Client({
        brokerURL: SOCKET_URL.BASE,
        reconnectDelay: RECONNECT_DELAY_MS,
        heartbeatIncoming: 25000,
        heartbeatOutgoing: 25000,
    });

    if (isNative()) client.beforeConnect = prepareConnectHeaders;

    client.onConnect = () => {
        console.log('[socket] CONNECTED', { path: location.pathname, t: Date.now() });
        state.isConnected = true;
        state.refreshFailures = 0;
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
        const { message } = frame.headers;
        console.error('ws-stomp-error', message);

        // 앱의 토큰 거부(만료·변조)만 갱신 대상이다. 웹은 CONNECT 헤더를 보내지 않아 이 오류가 없다
        if (isNative() && message?.toLowerCase().includes(INVALID_TOKEN_MESSAGE)) {
            void recoverFromInvalidToken(client);
        }
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
    state.refreshFailures = 0;
    state.failureCounted = false;
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
                void invalidateTripLists(queryClient);
                queryClient.invalidateQueries({ queryKey: shareKeys.all });
            }

            queryClient.invalidateQueries({ queryKey: SUMMARY_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: notificationKeys.all });

            if (messageType.startsWith('TRIP')) {
                await invalidateTripLists(queryClient);
                await queryClient.invalidateQueries({ queryKey: tripKeys.infoAll });
                // 경로 화면도 제목·기간을 들고 있다
                await queryClient.invalidateQueries({ queryKey: routeKeys.all });
            }

            if (messageType.startsWith('MEDIA')) {
                // tripKey가 없으면 어느 여행인지 몰라 표지·장수가 든 목록만 갱신한다
                void (subscribedMessage.tripKey
                    ? invalidateTripMedia(queryClient, subscribedMessage.tripKey)
                    : invalidateTripLists(queryClient));
            }
        } catch (error) {
            console.error('메시지 처리 오류:', error);
        }
    });
};

export const socket = {
    get isConnected() {
        return state.isConnected;
    },
    connect,
    disconnect,
};
