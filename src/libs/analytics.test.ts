import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_VERSION_NAME } from '@/platform/native/appVersion';

const { posthogMock, platformMock } = vi.hoisted(() => ({
    posthogMock: {
        init: vi.fn(),
        register: vi.fn(),
        identify: vi.fn(),
        capture: vi.fn(),
        reset: vi.fn(),
        get_distinct_id: vi.fn(),
        _isIdentified: vi.fn(),
    },
    platformMock: { isNative: vi.fn(() => false) },
}));

vi.mock('posthog-js', () => ({ default: posthogMock, posthog: posthogMock }));
vi.mock('@/platform', () => platformMock);

const TEST_KEY = 'phc_test_key';
const TEST_HOST = 'https://us.i.posthog.com';
const PENDING_KEY = 'triptyche.pendingAnalytics';
const PROVIDER_KEY = 'triptyche.loginProvider';

// 모듈 안의 initialized 플래그가 테스트끼리 새지 않도록 매번 새로 불러온다.
const loadAnalytics = async () => {
    vi.resetModules();
    return import('./analytics');
};

// 키가 있는 환경에서 init까지 마친 모듈을 돌려준다.
const loadInitialized = async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', TEST_KEY);
    vi.stubEnv('VITE_POSTHOG_HOST', TEST_HOST);
    const analytics = await loadAnalytics();
    await analytics.initAnalytics();
    posthogMock.register.mockClear();
    return analytics;
};

beforeEach(() => {
    Object.values(posthogMock).forEach((fn) => fn.mockReset());
    platformMock.isNative.mockReturnValue(false);
    posthogMock._isIdentified.mockReturnValue(false);
    posthogMock.get_distinct_id.mockReturnValue('anon-uuid');
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe('키가 없으면 no-op', () => {
    it('모든 함수가 posthog·스토리지·URL을 건드리지 않는다', async () => {
        vi.stubEnv('VITE_POSTHOG_KEY', '');
        const analytics = await loadAnalytics();
        window.history.replaceState(null, '', '/?signup=true');

        await analytics.initAnalytics();
        analytics.identifyUser({ userId: 1, role: 'USER', createdAt: '2026-11-11T21:00:55.253692' });
        analytics.track('trip_created');
        analytics.queuePendingEvent('guest_started');
        analytics.flushPendingEvents();
        analytics.rememberLoginProvider('KAKAO');
        const provider = analytics.consumeLoginProvider();
        const signedUp = analytics.consumeSignupQuery();
        analytics.resetAnalytics();

        Object.values(posthogMock).forEach((fn) => expect(fn).not.toHaveBeenCalled());
        expect(sessionStorage.length).toBe(0);
        expect(provider).toBeNull();
        expect(signedUp).toBe(false);
        expect(window.location.search).toBe('?signup=true');
    });

    it('init 전에 호출해도 아무 일도 없다', async () => {
        vi.stubEnv('VITE_POSTHOG_KEY', TEST_KEY);
        const analytics = await loadAnalytics();

        analytics.track('trip_created');
        analytics.identifyUser({ userId: 1, role: 'USER', createdAt: '2026-11-11T21:00:55' });

        expect(posthogMock.capture).not.toHaveBeenCalled();
        expect(posthogMock.identify).not.toHaveBeenCalled();
    });
});

describe('initAnalytics', () => {
    it('계획의 옵션으로 초기화한다', async () => {
        vi.stubEnv('VITE_POSTHOG_KEY', TEST_KEY);
        vi.stubEnv('VITE_POSTHOG_HOST', TEST_HOST);
        const analytics = await loadAnalytics();

        await analytics.initAnalytics();

        expect(posthogMock.init).toHaveBeenCalledWith(
            TEST_KEY,
            expect.objectContaining({
                api_host: TEST_HOST,
                person_profiles: 'identified_only',
                capture_pageview: 'history_change',
                autocapture: false,
                disable_session_recording: true,
                capture_dead_clicks: false,
                capture_heatmaps: false,
                capture_exceptions: false,
            }),
        );
    });

    it('웹이면 platform: web, app_version을 등록한다', async () => {
        vi.stubEnv('VITE_POSTHOG_KEY', TEST_KEY);
        const analytics = await loadAnalytics();

        await analytics.initAnalytics();

        expect(posthogMock.register).toHaveBeenCalledWith({ platform: 'web', app_version: APP_VERSION_NAME });
    });

    it('네이티브 앱이면 platform: app을 등록한다', async () => {
        platformMock.isNative.mockReturnValue(true);
        vi.stubEnv('VITE_POSTHOG_KEY', TEST_KEY);
        const analytics = await loadAnalytics();

        await analytics.initAnalytics();

        expect(posthogMock.register).toHaveBeenCalledWith(expect.objectContaining({ platform: 'app' }));
    });

    it('두 번 호출해도 한 번만 초기화한다', async () => {
        vi.stubEnv('VITE_POSTHOG_KEY', TEST_KEY);
        const analytics = await loadAnalytics();

        await Promise.all([analytics.initAnalytics(), analytics.initAnalytics()]);

        expect(posthogMock.init).toHaveBeenCalledTimes(1);
    });
});

describe('identifyUser', () => {
    const identity = { userId: 129, role: 'GUEST', createdAt: '2026-11-11T21:00:55.253692' } as const;

    it('userId를 문자열로, role과 signed_up_at만 속성으로 보낸다', async () => {
        const analytics = await loadInitialized();

        analytics.identifyUser(identity);

        expect(posthogMock.identify).toHaveBeenCalledWith('129', {
            role: 'GUEST',
            signed_up_at: '2026-11-11T21:00:55.253692',
        });
    });

    it('UserInfo 전체를 넘겨도 nickname 등은 PostHog로 가지 않는다', async () => {
        const analytics = await loadInitialized();
        const fullUserInfo = {
            ...identity,
            nickname: '게스트_05fd9070',
            email: 'secret@example.com',
            tripsCount: 2,
            unreadNotificationsCount: 0,
        };

        analytics.identifyUser(fullUserInfo);

        const [, properties] = posthogMock.identify.mock.calls[0];
        expect(Object.keys(properties).sort()).toEqual(['role', 'signed_up_at']);
        expect(JSON.stringify(posthogMock.identify.mock.calls)).not.toContain('게스트_05fd9070');
        expect(JSON.stringify(posthogMock.identify.mock.calls)).not.toContain('secret@example.com');
    });

    it('익명 상태면 reset하지 않고 바로 identify한다 (랜딩 퍼널 유지)', async () => {
        posthogMock._isIdentified.mockReturnValue(false);
        const analytics = await loadInitialized();

        analytics.identifyUser(identity);

        expect(posthogMock.reset).not.toHaveBeenCalled();
        expect(posthogMock.identify).toHaveBeenCalledTimes(1);
    });

    it('같은 사용자로 이미 identify돼 있으면 reset하지 않는다', async () => {
        posthogMock._isIdentified.mockReturnValue(true);
        posthogMock.get_distinct_id.mockReturnValue('129');
        const analytics = await loadInitialized();

        analytics.identifyUser(identity);

        expect(posthogMock.reset).not.toHaveBeenCalled();
        expect(posthogMock.identify).toHaveBeenCalledWith('129', expect.any(Object));
    });

    it('다른 id로 이미 identify돼 있으면 reset한 뒤 identify한다', async () => {
        posthogMock._isIdentified.mockReturnValue(true);
        posthogMock.get_distinct_id.mockReturnValue('7');
        const analytics = await loadInitialized();

        analytics.identifyUser(identity);

        expect(posthogMock.reset).toHaveBeenCalledTimes(1);
        expect(posthogMock.identify).toHaveBeenCalledTimes(1);
        expect(posthogMock.reset.mock.invocationCallOrder[0]).toBeLessThan(
            posthogMock.identify.mock.invocationCallOrder[0],
        );
    });

    it('reset은 super property를 지우므로 platform·app_version을 다시 등록한다', async () => {
        posthogMock._isIdentified.mockReturnValue(true);
        posthogMock.get_distinct_id.mockReturnValue('7');
        const analytics = await loadInitialized();

        analytics.identifyUser(identity);

        expect(posthogMock.register).toHaveBeenCalledWith({ platform: 'web', app_version: APP_VERSION_NAME });
        expect(posthogMock.register.mock.invocationCallOrder[0]).toBeGreaterThan(
            posthogMock.reset.mock.invocationCallOrder[0],
        );
    });
});

describe('track / resetAnalytics', () => {
    it('track은 capture로 이벤트와 속성을 넘긴다', async () => {
        const analytics = await loadInitialized();

        analytics.track('photos_uploaded', { count: 3 });
        analytics.track('trip_created');

        expect(posthogMock.capture).toHaveBeenNthCalledWith(1, 'photos_uploaded', { count: 3 });
        expect(posthogMock.capture).toHaveBeenNthCalledWith(2, 'trip_created', undefined);
    });

    it('resetAnalytics는 reset 후 공통 속성을 다시 등록한다', async () => {
        const analytics = await loadInitialized();

        analytics.resetAnalytics();

        expect(posthogMock.reset).toHaveBeenCalledTimes(1);
        expect(posthogMock.register).toHaveBeenCalledWith({ platform: 'web', app_version: APP_VERSION_NAME });
    });

    it('ANALYTICS_EVENTS는 퍼널 네 이벤트와 성능 진단 세 이벤트다', async () => {
        const analytics = await loadAnalytics();

        expect(analytics.ANALYTICS_EVENTS).toEqual({
            SIGNED_UP: 'signed_up',
            GUEST_STARTED: 'guest_started',
            TRIP_CREATED: 'trip_created',
            PHOTOS_UPLOADED: 'photos_uploaded',
            WEBGL_CONTEXT_LOST: 'webgl_context_lost',
            WEBGL_CONTEXT_RESTORED: 'webgl_context_restored',
            TICKET_COVER_TIMING: 'ticket_cover_timing',
        });
    });
});

describe('보류 이벤트 큐', () => {
    it('queue한 이벤트는 flush 때 순서대로 capture되고 큐가 비워진다', async () => {
        const analytics = await loadInitialized();

        analytics.queuePendingEvent('signed_up', { provider: 'KAKAO' });
        analytics.queuePendingEvent('guest_started');
        expect(JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? '[]')).toHaveLength(2);
        expect(posthogMock.capture).not.toHaveBeenCalled();

        analytics.flushPendingEvents();

        expect(posthogMock.capture).toHaveBeenNthCalledWith(1, 'signed_up', { provider: 'KAKAO' });
        expect(posthogMock.capture).toHaveBeenNthCalledWith(2, 'guest_started', undefined);
        expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
    });

    it('flush를 다시 호출해도 중복 전송하지 않는다', async () => {
        const analytics = await loadInitialized();
        analytics.queuePendingEvent('guest_started');

        analytics.flushPendingEvents();
        analytics.flushPendingEvents();

        expect(posthogMock.capture).toHaveBeenCalledTimes(1);
    });

    it('큐가 비어 있으면 아무것도 보내지 않는다', async () => {
        const analytics = await loadInitialized();

        analytics.flushPendingEvents();

        expect(posthogMock.capture).not.toHaveBeenCalled();
    });

    it('JSON이 깨져 있어도 던지지 않고 비운다', async () => {
        const analytics = await loadInitialized();
        sessionStorage.setItem(PENDING_KEY, '{not json');

        expect(() => analytics.flushPendingEvents()).not.toThrow();

        expect(posthogMock.capture).not.toHaveBeenCalled();
        expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
    });

    it('배열이 아니거나 형식이 틀린 항목은 무시한다', async () => {
        const analytics = await loadInitialized();
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ name: 'guest_started' }));
        analytics.flushPendingEvents();
        expect(posthogMock.capture).not.toHaveBeenCalled();

        sessionStorage.setItem(
            PENDING_KEY,
            JSON.stringify([
                null,
                1,
                { props: {} },
                { name: 'guest_started' },
                { name: 'guest_started', queuedAt: Date.now() },
            ]),
        );
        analytics.flushPendingEvents();

        expect(posthogMock.capture).toHaveBeenCalledTimes(1);
        expect(posthogMock.capture).toHaveBeenCalledWith('guest_started', undefined);
    });

    it('큐에 오래 남은 이벤트는 버리고 최근 것만 보낸다 (다른 계정 귀속 방지)', async () => {
        const analytics = await loadInitialized();
        const now = Date.now();
        sessionStorage.setItem(
            PENDING_KEY,
            JSON.stringify([
                { name: 'guest_started', queuedAt: now - 11 * 60 * 1000 },
                { name: 'signed_up', props: { provider: 'KAKAO' }, queuedAt: now - 60 * 1000 },
            ]),
        );

        analytics.flushPendingEvents();

        expect(posthogMock.capture).toHaveBeenCalledTimes(1);
        expect(posthogMock.capture).toHaveBeenCalledWith('signed_up', { provider: 'KAKAO' });
        expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
    });

    it('깨진 큐 위에 queue해도 새 이벤트는 남는다', async () => {
        const analytics = await loadInitialized();
        sessionStorage.setItem(PENDING_KEY, '{not json');

        analytics.queuePendingEvent('guest_started');
        analytics.flushPendingEvents();

        expect(posthogMock.capture).toHaveBeenCalledWith('guest_started', undefined);
    });

    it('스토리지가 던져도 queue·flush는 예외를 내지 않는다', async () => {
        const analytics = await loadInitialized();
        // 환경에 따라 전역 Storage 클래스와 sessionStorage의 프로토타입이 다를 수 있어 실제 프로토타입을 쓴다.
        const storageProto = Object.getPrototypeOf(sessionStorage);
        vi.spyOn(storageProto, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });
        vi.spyOn(storageProto, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });
        vi.spyOn(storageProto, 'removeItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });

        expect(() => analytics.queuePendingEvent('guest_started')).not.toThrow();
        expect(() => analytics.flushPendingEvents()).not.toThrow();
        expect(() => analytics.rememberLoginProvider('KAKAO')).not.toThrow();
        expect(analytics.consumeLoginProvider()).toBeNull();
        expect(posthogMock.capture).not.toHaveBeenCalled();
    });
});

describe('로그인 provider 기억', () => {
    it('remember한 값을 한 번만 꺼낼 수 있다', async () => {
        const analytics = await loadInitialized();

        analytics.rememberLoginProvider('GOOGLE');

        expect(sessionStorage.getItem(PROVIDER_KEY)).toBe('GOOGLE');
        expect(analytics.consumeLoginProvider()).toBe('GOOGLE');
        expect(analytics.consumeLoginProvider()).toBeNull();
        expect(sessionStorage.getItem(PROVIDER_KEY)).toBeNull();
    });
});

describe('consumeSignupQuery', () => {
    it('signup=true면 true를 돌려주고 그 파라미터만 URL에서 지운다', async () => {
        const analytics = await loadInitialized();
        window.history.replaceState({ idx: 3 }, '', '/home?signup=true&tab=map#top');

        expect(analytics.consumeSignupQuery()).toBe(true);

        expect(window.location.pathname).toBe('/home');
        expect(window.location.search).toBe('?tab=map');
        expect(window.location.hash).toBe('#top');
        expect(window.history.state).toEqual({ idx: 3 });
    });

    it('signup만 있던 쿼리는 물음표까지 사라진다', async () => {
        const analytics = await loadInitialized();
        window.history.replaceState(null, '', '/?signup=true');

        analytics.consumeSignupQuery();

        expect(window.location.search).toBe('');
        expect(window.location.href).toBe('http://localhost:3000/');
    });

    it('두 번째 호출은 false다 (새로고침 중복 방지)', async () => {
        const analytics = await loadInitialized();
        window.history.replaceState(null, '', '/?signup=true');

        expect(analytics.consumeSignupQuery()).toBe(true);
        expect(analytics.consumeSignupQuery()).toBe(false);
    });

    it('signup 파라미터가 없거나 true가 아니면 false이고 URL을 건드리지 않는다', async () => {
        const analytics = await loadInitialized();

        window.history.replaceState(null, '', '/?tab=map');
        expect(analytics.consumeSignupQuery()).toBe(false);
        expect(window.location.search).toBe('?tab=map');

        window.history.replaceState(null, '', '/?signup=false');
        expect(analytics.consumeSignupQuery()).toBe(false);
        expect(window.location.search).toBe('?signup=false');
    });
});

describe('지연 로드', () => {
    it('로드 전에 들어온 호출은 모아 뒀다가 로드되면 순서대로 실행한다', async () => {
        vi.stubEnv('VITE_POSTHOG_KEY', TEST_KEY);
        const analytics = await loadAnalytics();

        const ready = analytics.initAnalytics();
        analytics.identifyUser({ userId: 7, role: 'USER', createdAt: '2025-01-01' });
        analytics.track(analytics.ANALYTICS_EVENTS.TRIP_CREATED);
        expect(posthogMock.init).not.toHaveBeenCalled();

        await ready;

        expect(posthogMock.init).toHaveBeenCalledTimes(1);
        expect(posthogMock.identify.mock.invocationCallOrder[0]).toBeLessThan(
            posthogMock.capture.mock.invocationCallOrder[0],
        );
        expect(posthogMock.capture).toHaveBeenCalledWith('trip_created', undefined);
    });
});
