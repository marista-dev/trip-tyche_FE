import { PushNotifications } from '@capacitor/push-notifications';

import { isNative } from '@/platform';

/*
 * FCM 디바이스 토큰 등록.
 * 지금은 토큰을 로그로만 남긴다 — 백엔드 POST /v1/devices가 열리면 그 자리에 연결한다.
 */

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

const setupListeners = async () => {
    await PushNotifications.addListener('registration', ({ value }) => {
        console.log('[FCM] token:', value);
    });

    await PushNotifications.addListener('registrationError', (error) => {
        console.error('[FCM] 등록 실패: ', JSON.stringify(error));
    });

    // 앱이 떠 있을 때 도착한 알림. OS 알림은 뜨지 않으므로 지금은 로그로만 확인한다.
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[FCM] 포그라운드 수신: ', JSON.stringify(notification));
    });

    // 알림을 탭했을 때. 추후 data.deeplink로 화면 이동을 붙일 자리다.
    await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        console.log('[FCM] 알림 탭: ', JSON.stringify(notification.data));
    });
};

export const setupPushNotifications = async () => {
    if (!isNative()) return;

    try {
        await setupListeners();

        if (!(await requestPermission())) return;

        await PushNotifications.register();
    } catch (error) {
        console.warn('푸시 알림 초기화 실패: ', error);
    }
};
