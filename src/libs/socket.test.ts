import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { socket } from '@/libs/socket';

const mocks = vi.hoisted(() => ({
    isNative: vi.fn(),
    getAccessToken: vi.fn(),
    refresh: vi.fn(),
    clients: [] as {
        config: Record<string, unknown>;
        beforeConnect?: (client: unknown) => Promise<void>;
        onConnect?: () => void;
        onStompError: (frame: { headers: Record<string, string> }) => void;
        connectHeaders: Record<string, string>;
        connected: boolean;
        activate: () => void;
        deactivate: () => void;
        forceDisconnect: () => void;
    }[],
}));

vi.mock('@stomp/stompjs', () => ({
    // 실제 소켓을 열지 않고 생성 설정과 콜백만 붙잡는다
    Client: class {
        config: Record<string, unknown>;
        connectHeaders: Record<string, string> = {};
        connected = false;
        active = true;
        activate = vi.fn();
        deactivate = vi.fn();
        forceDisconnect = vi.fn();
        subscribe = vi.fn();
        onStompError = vi.fn();

        constructor(config: Record<string, unknown>) {
            this.config = config;
            mocks.clients.push(this as never);
        }
    },
}));
vi.mock('@/platform', () => ({ isNative: () => mocks.isNative() }));
vi.mock('@/platform/native/auth', () => ({
    getAccessToken: () => mocks.getAccessToken(),
    refreshAccessTokenResult: () => mocks.refresh(),
}));
vi.mock('@/shared/constants/socket', () => ({
    SOCKET_URL: { BASE: 'wss://example.test/ws', TOPIC: { REQUEST: (id: string) => `/topic/${id}` } },
}));
vi.mock('@/shared/providers/TanStackProvider', () => ({ queryClient: {} }));

const base64Url = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

/** exp(초 단위 epoch)만 읽으므로 서명은 아무 값이나 둔다 */
const jwt = (expSecondsFromNow: number) =>
    `${base64Url({ alg: 'HS256' })}.${base64Url({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })}.sig`;

const connectClient = () => {
    socket.connect('1');
    const client = mocks.clients[mocks.clients.length - 1];
    return client;
};

type TestClient = ReturnType<typeof connectClient>;

const rejectToken = (client: TestClient) => client.onStompError({ headers: { message: 'invalid token' } });

describe('socket — STOMP 인증', () => {
    beforeEach(() => {
        mocks.clients.length = 0;
        mocks.isNative.mockReset().mockReturnValue(true);
        mocks.getAccessToken.mockReset().mockReturnValue(null);
        mocks.refresh.mockReset().mockResolvedValue('refreshed');
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        socket.disconnect();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('앱', () => {
        it('토큰을 URL에 싣지 않는다', () => {
            mocks.getAccessToken.mockReturnValue(jwt(3600));

            const client = connectClient();

            expect(client.config.brokerURL).toBe('wss://example.test/ws');
            expect(String(client.config.brokerURL)).not.toContain('token');
        });

        it('접속(재접속)할 때마다 그 시점의 토큰으로 CONNECT 헤더를 만든다', async () => {
            const first = jwt(3600);
            const second = jwt(7200);
            mocks.getAccessToken.mockReturnValue(first);
            const client = connectClient();

            await client.beforeConnect?.(client);
            expect(client.connectHeaders).toEqual({ Authorization: `Bearer ${first}` });

            // 그 사이 axios 쪽 갱신으로 토큰이 바뀐 상황
            mocks.getAccessToken.mockReturnValue(second);
            await client.beforeConnect?.(client);
            expect(client.connectHeaders).toEqual({ Authorization: `Bearer ${second}` });
            expect(mocks.refresh).not.toHaveBeenCalled();
        });

        it('만료된 토큰이면 갱신한 뒤 새 토큰으로 접속한다', async () => {
            const expired = jwt(-60);
            const fresh = jwt(3600);
            mocks.getAccessToken.mockReturnValue(expired);
            mocks.refresh.mockImplementation(async () => {
                mocks.getAccessToken.mockReturnValue(fresh);
                return 'refreshed';
            });
            const client = connectClient();

            await client.beforeConnect?.(client);

            expect(mocks.refresh).toHaveBeenCalledTimes(1);
            expect(client.connectHeaders).toEqual({ Authorization: `Bearer ${fresh}` });
        });

        it('만료 직전(여유 시간 이내)이어도 미리 갱신한다', async () => {
            mocks.getAccessToken.mockReturnValue(jwt(10));
            const client = connectClient();

            await client.beforeConnect?.(client);

            expect(mocks.refresh).toHaveBeenCalledTimes(1);
        });

        it('토큰이 없고 갱신도 실패하면 헤더 없이 접속하고, 던지지 않는다', async () => {
            mocks.refresh.mockResolvedValue('rejected');
            const client = connectClient();
            client.connectHeaders = { Authorization: 'Bearer stale' };

            await expect(client.beforeConnect?.(client)).resolves.toBeUndefined();

            expect(mocks.refresh).toHaveBeenCalledTimes(1);
            expect(client.connectHeaders).toEqual({});
        });

        it('갱신이 reject돼도 beforeConnect는 던지지 않는다 (던지면 stompjs가 재연결을 멈춘다)', async () => {
            mocks.refresh.mockRejectedValue(new Error('network'));
            const client = connectClient();

            await expect(client.beforeConnect?.(client)).resolves.toBeUndefined();
        });

        it('토큰 거부 ERROR 프레임이면 토큰을 갱신하고 소켓을 닫아 stompjs 재연결에 맡긴다', async () => {
            mocks.getAccessToken.mockReturnValue(jwt(3600));
            const client = connectClient();

            rejectToken(client);
            await vi.waitFor(() => expect(client.forceDisconnect).toHaveBeenCalledTimes(1));

            expect(mocks.refresh).toHaveBeenCalledTimes(1);
            // 별도 재연결 장치를 만들지 않는다
            expect(client.activate).toHaveBeenCalledTimes(1);
            expect(client.deactivate).not.toHaveBeenCalled();
        });

        it('토큰과 무관한 ERROR 프레임은 갱신하지 않는다', async () => {
            const client = connectClient();

            client.onStompError({ headers: { message: 'forbidden topic subscription' } });
            await Promise.resolve();

            expect(mocks.refresh).not.toHaveBeenCalled();
            expect(client.forceDisconnect).not.toHaveBeenCalled();
        });

        describe('갱신 실패', () => {
            it('서버가 거절했거나 refresh 토큰이 없으면(확정 실패) 재연결을 멈추고 로그아웃은 인증 흐름에 맡긴다', async () => {
                mocks.refresh.mockResolvedValue('rejected');
                const client = connectClient();

                rejectToken(client);
                await vi.waitFor(() => expect(client.deactivate).toHaveBeenCalledTimes(1));

                // 5초마다 같은 오류를 반복하게 두지 않는다
                expect(client.forceDisconnect).not.toHaveBeenCalled();
                expect(socket.isConnected).toBe(false);
            });

            it('멈춘 뒤 로그인으로 connect()가 다시 불리면 새 클라이언트로 접속한다', async () => {
                mocks.refresh.mockResolvedValue('rejected');
                const dead = connectClient();
                rejectToken(dead);
                await vi.waitFor(() => expect(dead.deactivate).toHaveBeenCalledTimes(1));

                mocks.refresh.mockResolvedValue('refreshed');
                const revived = connectClient();

                expect(revived).not.toBe(dead);
                expect(revived.activate).toHaveBeenCalledTimes(1);
                // 멈춘 클라이언트의 늦은 콜백이 새 클라이언트를 끊지 않는다
                expect(revived.deactivate).not.toHaveBeenCalled();
                expect(revived.forceDisconnect).not.toHaveBeenCalled();
            });

            it('갱신하는 사이 disconnect되면 아무것도 건드리지 않는다', async () => {
                let finishRefresh: (result: string) => void = () => {};
                mocks.refresh.mockReturnValue(new Promise<string>((resolve) => (finishRefresh = resolve)));
                const client = connectClient();

                rejectToken(client);
                socket.disconnect();
                expect(client.deactivate).toHaveBeenCalledTimes(1);
                finishRefresh('rejected');
                await Promise.resolve();
                await Promise.resolve();

                expect(client.deactivate).toHaveBeenCalledTimes(1);
                expect(client.forceDisconnect).not.toHaveBeenCalled();
            });

            describe('일시 실패(네트워크·타임아웃·5xx)', () => {
                // beforeConnect가 stompjs의 5s 간격 외에 얼마나 더 기다리는지 잰다
                const expectExtraWait = async (client: TestClient, ms: number) => {
                    let resolved = false;
                    void client.beforeConnect?.(client)?.then(() => (resolved = true));

                    if (ms > 0) {
                        await vi.advanceTimersByTimeAsync(ms - 1);
                        expect(resolved).toBe(false);
                    }
                    await vi.advanceTimersByTimeAsync(1);
                    expect(resolved).toBe(true);
                };

                const failOnce = async (client: TestClient) => {
                    rejectToken(client);
                    await vi.advanceTimersByTimeAsync(0);
                };

                beforeEach(() => {
                    vi.useFakeTimers();
                    mocks.refresh.mockResolvedValue('transient');
                    mocks.getAccessToken.mockReturnValue(jwt(3600));
                });

                it('소켓을 살려 두고 stompjs 재연결에 맡긴다', async () => {
                    const client = connectClient();

                    await failOnce(client);

                    expect(client.deactivate).not.toHaveBeenCalled();
                    expect(client.forceDisconnect).toHaveBeenCalledTimes(1);
                    expect(client.activate).toHaveBeenCalledTimes(1);
                });

                it('연속으로 실패할수록 재연결 간격이 늘어나고 60초에서 멈춘다', async () => {
                    const client = connectClient();
                    // 처음에는 stompjs 기본 간격(5s) 그대로
                    await expectExtraWait(client, 0);

                    // 실패 n번 뒤 총 간격: 10s, 20s, 40s, 60s(상한) → stompjs의 5s를 뺀 만큼 더 기다린다
                    const extraWaits = [5000, 15000, 35000, 55000, 55000, 55000];
                    for (const extra of extraWaits) {
                        await failOnce(client);
                        await expectExtraWait(client, extra);
                    }
                });

                // beforeConnect가 만료 토큰으로 갱신하고(일시 실패), 이어서 서버의 ERROR 처리도 갱신한다
                it('한 접속 시도에서 두 경로가 같은 일시 실패를 겪어도 한 번만 세어 5→10→20→40→60초로 늘어난다', async () => {
                    mocks.getAccessToken.mockReturnValue(jwt(-60));
                    const client = connectClient();

                    // 시도마다 총 간격: 5s(처음), 10s, 20s, 40s, 60s, 60s → stompjs의 5s를 뺀 만큼 더 기다린다
                    for (const extra of [0, 5000, 15000, 35000, 55000, 55000]) {
                        await expectExtraWait(client, extra);
                        await failOnce(client);
                        expect(mocks.refresh).toHaveBeenCalled();
                    }
                });

                it('두 경로가 같은 진행 중인 갱신을 함께 기다려도 한 번만 센다', async () => {
                    mocks.getAccessToken.mockReturnValue(jwt(-60));
                    let finishRefresh: (result: string) => void = () => {};
                    const shared = new Promise<string>((resolve) => (finishRefresh = resolve));
                    mocks.refresh.mockReturnValue(shared);
                    const client = connectClient();

                    const connecting = client.beforeConnect?.(client);
                    rejectToken(client);
                    finishRefresh('transient');
                    await connecting;
                    await vi.advanceTimersByTimeAsync(0);

                    await expectExtraWait(client, 5000);
                });

                it('연결에 성공하면 간격이 처음으로 돌아간다', async () => {
                    const client = connectClient();
                    await failOnce(client);
                    await expectExtraWait(client, 5000);
                    await failOnce(client);
                    await expectExtraWait(client, 15000);

                    client.onConnect?.();

                    await expectExtraWait(client, 0);
                });

                it('갱신이 다시 성공해도 간격이 돌아간다', async () => {
                    const client = connectClient();
                    await failOnce(client);
                    await expectExtraWait(client, 5000);

                    mocks.refresh.mockResolvedValue('refreshed');
                    await failOnce(client);

                    await expectExtraWait(client, 0);
                });

                it('기다리는 사이 disconnect되면 그 클라이언트는 더 진행하지 않는다', async () => {
                    mocks.getAccessToken.mockReturnValue(jwt(-60));
                    const client = connectClient();
                    await failOnce(client);
                    mocks.refresh.mockClear();

                    const connecting = client.beforeConnect?.(client);
                    socket.disconnect();
                    await vi.advanceTimersByTimeAsync(60 * 1000);
                    await connecting;

                    expect(mocks.refresh).not.toHaveBeenCalled();
                });
            });
        });
    });

    describe('웹', () => {
        beforeEach(() => mocks.isNative.mockReturnValue(false));

        it('쿠키 인증을 그대로 쓴다: URL에 토큰이 없고 CONNECT 헤더·갱신 훅이 없다', () => {
            mocks.getAccessToken.mockReturnValue(jwt(3600));

            const client = connectClient();

            expect(client.config.brokerURL).toBe('wss://example.test/ws');
            // 기본 no-op beforeConnect를 덮어쓰지 않았다
            expect(client.beforeConnect).toBeUndefined();
            expect(client.connectHeaders).toEqual({});
        });

        it('ERROR 프레임에도 토큰을 갱신하지 않는다', async () => {
            const client = connectClient();

            rejectToken(client);
            await Promise.resolve();

            expect(mocks.refresh).not.toHaveBeenCalled();
        });
    });
});
