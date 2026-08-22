import type { CapacitorConfig } from '@capacitor/cli';

/*
 * 라이브 리로드(선택). CAP_DEV_SERVER_URL이 있으면 번들 대신 dev 서버에서 앱을 띄운다.
 * 에뮬레이터에서 호스트를 가리키려면 10.0.2.2를 쓴다.
 *   예) CAP_DEV_SERVER_URL=http://10.0.2.2:3000 npx cap sync android
 * dev 빌드(import.meta.env.DEV=true)로 동작하므로 DEV 로그인 같은 개발 전용 진입점을 쓸 수 있다.
 * 값이 없으면 평소대로 webDir 번들을 로드한다.
 */
const devServerUrl = process.env.CAP_DEV_SERVER_URL;

const config: CapacitorConfig = {
    appId: 'cloud.triptyche.app',
    appName: '트립티케',
    webDir: 'dist',
    server: {
        // WebView origin을 https://localhost로 고정한다.
        // Google Maps 앱 키의 referrer 제한, 백엔드 CORS 허용 목록이 이 origin을 전제로 한다.
        androidScheme: 'https',
        ...(devServerUrl ? { url: devServerUrl, cleartext: true } : {}),
    },
    plugins: {
        /*
         * XHR/fetch를 네이티브 HTTP로 우회시켜 CORS 프리플라이트를 건너뛴다.
         * 백엔드가 아직 https://localhost origin을 허용하지 않아(Phase 6-1) 임시로 켠 개발 편의 설정이며,
         * CORS가 정식 적용되면 제거를 검토한다.
         * 주의: STOMP WebSocket은 이 우회 대상이 아니므로 실시간 알림은 Phase 6 이후에야 동작한다.
         */
        CapacitorHttp: {
            enabled: true,
        },
        SplashScreen: {
            // 웹 자산 로드가 끝나면 appShell이 직접 숨긴다. 자동 종료를 끄지 않으면 흰 화면이 잠깐 보인다.
            launchAutoHide: false,
            backgroundColor: '#ffffff',
        },
    },
};

export default config;
