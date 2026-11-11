import { posthog, type Properties } from 'posthog-js';

import type { UserInfo } from '@/domains/user/types';
import { isNative } from '@/platform';
import { APP_VERSION_NAME } from '@/platform/native/appVersion';

/*
 * PostHog 연동의 유일한 창구. 호출부는 posthog-js를 직접 import하지 않고 이 모듈만 쓴다.
 *
 * 개인정보 원칙: PostHog에는 userId·role·가입 시각만 보낸다. 이메일·이름·닉네임은 보내지 않는다.
 * autocapture와 세션 녹화를 끈 이유도 같다. 켜 두면 화면 텍스트(닉네임)가 그대로 수집된다.
 *
 * platform/native/auth.ts에서도 import되므로 apiClient 같은 무거운 모듈을 끌어오면 순환 의존이 생긴다.
 * 여기서는 타입 import(UserInfo)와 가벼운 platform 모듈만 참조한다.
 *
 * 키(VITE_POSTHOG_KEY)가 없으면 아래 함수는 모두 no-op이다. 테스트와 로컬 개발이 자동으로 수집에서 빠지고,
 * 키가 없는 빌드에서도 호출부에 분기를 둘 필요가 없다.
 * 로컬 개발은 .env.local에 `VITE_POSTHOG_KEY=`를 빈 값으로 명시해야 한다. Vite가 .env와 .env.local을 합쳐 읽어서,
 * 줄 자체가 없으면 .env의 운영 키가 그대로 적용돼 npm run dev가 운영 PostHog로 수집한다.
 */

export const ANALYTICS_EVENTS = {
    SIGNED_UP: 'signed_up',
    GUEST_STARTED: 'guest_started',
    TRIP_CREATED: 'trip_created',
    PHOTOS_UPLOADED: 'photos_uploaded',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

// 닉네임 등 다른 필드를 받지 못하도록 필요한 세 필드만 골라 쓴다.
export type AnalyticsIdentity = Pick<UserInfo, 'userId' | 'role' | 'createdAt'>;

const PENDING_EVENTS_KEY = 'triptyche.pendingAnalytics';
const LOGIN_PROVIDER_KEY = 'triptyche.loginProvider';
const SIGNUP_QUERY_KEY = 'signup';

// 보류 이벤트는 새로고침 한 번 사이에만 의미가 있다. 이보다 오래 남은 것은 부팅 실패로 못 보낸 잔여물이다.
const PENDING_EVENT_MAX_AGE_MS = 10 * 60 * 1000;

interface PendingEvent {
    name: AnalyticsEvent;
    props?: Properties;
    queuedAt: number;
}

// 키가 없거나 init 전이면 false로 남아 모든 함수가 아무것도 하지 않는다.
let initialized = false;

/*
 * reset()은 super property까지 지운다. 그래서 reset 뒤에는 platform·app_version을 다시 등록하지 않으면
 * 로그아웃·계정 전환 이후의 이벤트에서 이 값이 빠진다.
 */
const registerBaseProperties = () => {
    posthog.register({
        platform: isNative() ? 'app' : 'web',
        app_version: APP_VERSION_NAME,
    });
};

export const initAnalytics = (): void => {
    const key = import.meta.env.VITE_POSTHOG_KEY;
    if (!key || initialized) return;

    posthog.init(key, {
        api_host: import.meta.env.VITE_POSTHOG_HOST,
        // 익명 방문자는 프로필을 만들지 않는다. identify된 사용자만 person으로 남아 비용과 노이즈를 줄인다.
        person_profiles: 'identified_only',
        // SPA라 페이지 이동이 전체 로드가 아니다. history 변경을 $pageview로 잡아야 라우팅이 측정된다.
        capture_pageview: 'history_change',
        autocapture: false,
        disable_session_recording: true,
        // 아래 자동 수집은 기본값이 아니라 PostHog 프로젝트의 원격 설정을 따른다. 프로젝트에서 켜져도 요소 텍스트(닉네임)나
        // 예외 메시지가 새지 않도록 코드에서 명시적으로 막는다.
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_exceptions: false,
    });
    registerBaseProperties();
    initialized = true;
};

export const identifyUser = ({ userId, role, createdAt }: AnalyticsIdentity): void => {
    if (!initialized) return;

    const distinctId = String(userId);
    /*
     * 이미 다른 사용자로 identify된 브라우저(예: 게스트 → 다른 계정)에서 그대로 identify하면
     * 두 사용자가 한 person으로 합쳐진다. 먼저 reset해 새 익명 id에서 시작한다.
     * 익명 상태에서는 reset하지 않는다. 익명 id가 identify로 이어져야 랜딩 퍼널이 끊기지 않는다.
     * _isIdentified는 밑줄 접두 내부 API다(타입에는 선언돼 있다). posthog-js 업그레이드 때 이 호출이 깨지지 않는지
     * analytics.test.ts의 identify 테스트와 함께 확인한다.
     */
    if (posthog._isIdentified() && posthog.get_distinct_id() !== distinctId) {
        posthog.reset();
        registerBaseProperties();
    }
    posthog.identify(distinctId, { role, signed_up_at: createdAt });
};

export const track = (event: AnalyticsEvent, props?: Properties): void => {
    if (!initialized) return;
    posthog.capture(event, props);
};

// 로그아웃에서만 호출한다. 비로그인 방문자도 부팅마다 인증 실패 경로를 타므로 거기서 호출하면 익명 id가 매번 바뀐다.
export const resetAnalytics = (): void => {
    if (!initialized) return;
    posthog.reset();
    registerBaseProperties();
};

/*
 * 보류 이벤트: 로그인·게스트 진입은 전체 새로고침으로 끝나서 identify가 새로고침 뒤에야 일어난다.
 * 새로고침 직전에 capture하면 전송 큐가 유실될 수 있으므로 sessionStorage에 적어 두었다가,
 * 부팅 후 identify가 끝난 시점에 flushPendingEvents()로 보낸다.
 * 게스트 진입 직후 부팅에서 summary 조회가 실패하면 이벤트가 큐에 남는다. 같은 탭에서 나중에 다른 계정으로 로그인하면
 * 그 계정의 이벤트로 잘못 귀속되므로, 적은 시각(queuedAt)을 함께 저장해 flush 때 오래된 항목은 버린다.
 * 스토리지 접근은 사생활 모드·용량 초과로 던질 수 있고, 분석 실패가 로그인 흐름을 막으면 안 되므로 모두 삼킨다.
 */
const readPendingEvents = (): PendingEvent[] => {
    try {
        const parsed: unknown = JSON.parse(sessionStorage.getItem(PENDING_EVENTS_KEY) ?? '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (item): item is PendingEvent =>
                typeof item === 'object' &&
                item !== null &&
                typeof item.name === 'string' &&
                typeof item.queuedAt === 'number',
        );
    } catch {
        return [];
    }
};

export const queuePendingEvent = (name: AnalyticsEvent, props?: Properties): void => {
    if (!initialized) return;
    try {
        sessionStorage.setItem(
            PENDING_EVENTS_KEY,
            JSON.stringify([...readPendingEvents(), { name, props, queuedAt: Date.now() }]),
        );
    } catch {
        // 보류 이벤트를 못 적어도 로그인 흐름은 계속된다. 이 이벤트 하나만 잃는다.
    }
};

export const flushPendingEvents = (): void => {
    if (!initialized) return;

    const events = readPendingEvents();
    // 보내기 전에 먼저 지운다. 도중에 예외가 나거나 새로고침돼도 같은 이벤트가 두 번 집계되지 않는다.
    try {
        sessionStorage.removeItem(PENDING_EVENTS_KEY);
    } catch {
        // 지우지 못하면 다음 부팅에서 중복 전송될 수 있으므로 보내지 않는다.
        return;
    }
    const now = Date.now();
    events
        .filter(({ queuedAt }) => now - queuedAt <= PENDING_EVENT_MAX_AGE_MS)
        .forEach(({ name, props }) => track(name, props));
};

/*
 * 웹 OAuth 리다이렉트에는 어느 provider로 로그인했는지가 실려 오지 않는다.
 * 리다이렉트로 페이지를 떠나기 직전에 적어 두고, 돌아온 뒤 signed_up 속성으로 꺼내 쓴다.
 */
export const rememberLoginProvider = (provider: string): void => {
    if (!initialized) return;
    try {
        sessionStorage.setItem(LOGIN_PROVIDER_KEY, provider);
    } catch {
        // provider 속성만 빠진다.
    }
};

// 한 번 꺼내면 지운다. 이후 부팅(새로고침)에서 이전 로그인의 provider가 다시 붙지 않게 한다.
export const consumeLoginProvider = (): string | null => {
    if (!initialized) return null;
    try {
        const provider = sessionStorage.getItem(LOGIN_PROVIDER_KEY);
        sessionStorage.removeItem(LOGIN_PROVIDER_KEY);
        return provider;
    } catch {
        return null;
    }
};

/*
 * 백엔드는 신규 가입 웹 리다이렉트에만 ?signup=true를 붙인다.
 * 읽은 즉시 URL에서 지워야 새로고침·북마크로 signed_up이 중복 집계되지 않는다.
 * history.state를 그대로 넘기는 이유: react-router가 여기에 위치 키를 저장하므로 비우면 라우터 상태가 어긋난다.
 */
export const consumeSignupQuery = (): boolean => {
    if (!initialized) return false;

    const url = new URL(window.location.href);
    if (url.searchParams.get(SIGNUP_QUERY_KEY) !== 'true') return false;

    url.searchParams.delete(SIGNUP_QUERY_KEY);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    return true;
};
