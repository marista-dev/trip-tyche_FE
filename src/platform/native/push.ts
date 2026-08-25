import { PushNotifications } from '@capacitor/push-notifications';

import { deviceAPI } from '@/libs/apis/device';
import { isNative } from '@/platform';
import { APP_VERSION_NAME } from '@/platform/native/appVersion';

/*
 * FCM 푸시.
 *
 * 역할 분담이 STOMP와 나뉘어 있다.
 *   앱이 앞에 있을 때  → STOMP 배너 (수락/거절 버튼이 있고 shareId가 필요한데 FCM payload에는 없다)
 *   백그라운드·종료    → FCM OS 알림 → 탭하면 딥링크로 이동
 * Capacitor가 포그라운드에서 OS 알림을 억제하므로 둘이 겹치지 않는다.
 */

// 채널을 선언하지 않으면 시스템 기본 중요도로 떨어져 헤드업 배너가 뜨지 않는다.
// AndroidManifest의 default_notification_channel_id와 반드시 같은 값이어야 한다.
const CHANNEL_ID = 'triptyche_default';

/*
 * 발급받은 FCM 토큰을 들고 있는다.
 * 서버 등록은 인증이 필요해 로그인 이후에나 가능한데, 토큰 발급은 그보다 먼저 끝나기 때문이다.
 */
let fcmToken: string | null = null;

export const getFcmToken = (): string | null => fcmToken;

const createDefaultChannel = async () => {
    try {
        await PushNotifications.createChannel({
            id: CHANNEL_ID,
            name: '여행 알림',
            description: '공유 요청, 사진 추가 등 여행 관련 알림',
            importance: 5, // MAX — 헤드업 배너
            visibility: 1,
        });
    } catch (error) {
        console.warn('[FCM] 알림 채널 생성 실패: ', error);
    }
};

/*
 * Android 13+는 POST_NOTIFICATIONS 런타임 권한이 필요하다.
 * 거부돼도 토큰은 정상 발급되고 서버 발송도 성공으로 찍히는데 기기에만 뜨지 않아
 * 원인을 찾기 어렵다. 그래서 권한 결과를 먼저 확인해 로그로 남긴다.
 */
const requestPermission = async () => {
    const { receive } = await PushNotifications.requestPermissions();

    if (receive !== 'granted') {
        console.warn('[FCM] 알림 권한 거부됨 — 토큰은 발급되지만 알림은 표시되지 않는다');
        return false;
    }

    return true;
};

// triptyche://trip/{tripKey} → /trip/{tripKey}
const toAppPath = (deeplink: string): string => deeplink.replace(/^triptyche:\/\//, '/');

const setupListeners = async () => {
    await PushNotifications.addListener('registration', ({ value }) => {
        fcmToken = value;
        // 이미 로그인된 상태에서 토큰이 갱신될 수 있으므로 여기서도 등록을 시도한다.
        void registerDeviceToken();
    });

    await PushNotifications.addListener('registrationError', (error) => {
        console.error('[FCM] 등록 실패: ', JSON.stringify(error));
    });

    /*
     * 앱이 떠 있을 때 도착한 알림. OS 알림은 표시되지 않는다.
     * 여기서 배너를 띄우면 STOMP 배너와 중복되므로 아무것도 하지 않는다.
     */
    await PushNotifications.addListener('pushNotificationReceived', () => {});

    await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const deeplink = notification.data?.deeplink;

        // 서버가 tripKey를 못 구하면 deeplink 키 자체를 넣지 않는다. 그때는 홈으로 보낸다.
        window.location.replace(deeplink ? toAppPath(deeplink) : '/');
    });
};

export const setupPushNotifications = async () => {
    if (!isNative()) return;

    try {
        await setupListeners();
        await createDefaultChannel();

        if (!(await requestPermission())) return;

        await PushNotifications.register();
    } catch (error) {
        console.warn('푸시 알림 초기화 실패: ', error);
    }
};

/*
 * 서버에 디바이스 토큰을 등록한다. 인증이 필요하므로 로그인 이후에 호출해야 한다.
 * 서버가 upsert로 처리하고 무효 토큰을 스스로 지우므로, 로그인할 때마다 불러도 안전하고
 * 서버가 지운 뒤에도 자동으로 복구된다.
 */
export const registerDeviceToken = async () => {
    if (!isNative() || !fcmToken) return;

    try {
        await deviceAPI.register(fcmToken, APP_VERSION_NAME);
    } catch (error) {
        // 알림이 안 오는 것뿐이므로 로그인 흐름을 막지 않는다.
        console.warn('[FCM] 디바이스 등록 실패: ', error);
    }
};

// 로그아웃 시 호출. 안 하면 로그아웃한 기기로 계속 알림이 간다.
export const unregisterDeviceToken = async () => {
    if (!isNative() || !fcmToken) return;

    try {
        await deviceAPI.unregister(fcmToken);
    } catch (error) {
        console.warn('[FCM] 디바이스 해제 실패: ', error);
    }
};
