import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

import { isNative } from '@/platform';
import { exchangeCodeForTokens, hydrateTokens } from '@/platform/native/auth';

// 백엔드와 합의된 OAuth 콜백 스킴. AndroidManifest의 intent-filter와 반드시 일치해야 한다.
export const AUTH_CALLBACK_SCHEME = 'triptyche://auth/callback';

/*
 * 네이티브 셸에서만 필요한 초기화. 웹에서는 전부 no-op이다.
 * 플러그인 호출이 실패해도 앱은 계속 떠야 하므로 개별적으로 감싼다 —
 * 셸 장식(상태바·스플래시) 때문에 본 기능이 막히는 상황을 만들지 않는다.
 */

const setupStatusBar = async () => {
    try {
        // RootLayout의 기본 배경이 흰색이므로 밝은 배경용 스타일(어두운 아이콘)을 쓴다.
        await StatusBar.setStyle({ style: Style.Light });
    } catch (error) {
        console.warn('상태바 설정 실패: ', error);
    }
};

// 하드웨어 백버튼 → 라우터 히스토리. 더 갈 곳이 없으면 앱을 종료한다.
// createBrowserRouter가 History API를 쓰므로 history.back()이 그대로 라우터 뒤로가기가 된다.
const setupBackButton = async () => {
    try {
        await App.addListener('backButton', ({ canGoBack }) => {
            if (canGoBack) {
                window.history.back();
            } else {
                App.exitApp();
            }
        });
    } catch (error) {
        console.warn('백버튼 리스너 등록 실패: ', error);
    }
};

/*
 * OAuth 딥링크 수신. 백엔드가 인증 성공 후 아래 형태로 302 리다이렉트한다.
 *   triptyche://auth/callback?code=<1회용 code>
 * code를 토큰으로 교환한 뒤 홈으로 보낸다. 실패해도 로그인 화면에 머무를 뿐 앱은 죽지 않는다.
 */
const setupAuthDeepLink = async () => {
    try {
        await App.addListener('appUrlOpen', async ({ url }) => {
            if (!url.startsWith(AUTH_CALLBACK_SCHEME)) return;

            // 커스텀 스킴은 URL 파서가 쿼리를 못 읽는 경우가 있어 직접 잘라낸다.
            const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
            const code = new URLSearchParams(query).get('code');

            if (!code) {
                console.error('인증 콜백에 code가 없습니다: ', url);
                return;
            }

            try {
                await Browser.close();
            } catch {
                // 인앱 브라우저가 이미 닫혔을 수 있다. 무시하고 진행한다.
            }

            const exchanged = await exchangeCodeForTokens(code);
            if (exchanged) window.location.replace('/');
        });
    } catch (error) {
        console.warn('딥링크 리스너 등록 실패: ', error);
    }
};

export const initAppShell = async () => {
    if (!isNative()) return;

    // 저장된 토큰을 먼저 메모리로 올린다. 이후 첫 API 요청이 인증 헤더를 실을 수 있어야 한다.
    await hydrateTokens();

    await setupStatusBar();
    await setupBackButton();
    await setupAuthDeepLink();

    try {
        await SplashScreen.hide();
    } catch (error) {
        console.warn('스플래시 종료 실패: ', error);
    }
};

/*
 * 외부 링크를 여는 유일한 창구.
 * WebView에서 location.href로 외부 URL을 열면 앱 화면이 그 페이지로 대체돼 돌아올 수 없다.
 * 네이티브에서는 시스템 브라우저(Custom Tabs)로 띄우고, 웹에서는 새 탭을 연다.
 */
export const openExternalLink = async (url: string) => {
    if (!isNative()) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }

    await Browser.open({ url });
};
