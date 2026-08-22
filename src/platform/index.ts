import { Capacitor } from '@capacitor/core';

/*
 * 웹과 네이티브 앱이 같은 소스를 공유하므로, 플랫폼 분기는 이 모듈 하나를 거친다.
 * 네이티브 전용 구현은 src/platform/native/ 아래에 격리하고, 호출부에서는 isNative()로만 갈라낸다.
 */

// Capacitor 셸(WebView) 안에서 실행 중인지. 일반 브라우저면 false.
export const isNative = (): boolean => Capacitor.isNativePlatform();

export const isAndroid = (): boolean => Capacitor.getPlatform() === 'android';

export const isIOS = (): boolean => Capacitor.getPlatform() === 'ios';
