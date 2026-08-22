import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'cloud.triptyche.app',
    appName: '트립티케',
    webDir: 'dist',
    server: {
        // WebView origin을 https://localhost로 고정한다.
        // Google Maps 앱 키의 referrer 제한, 백엔드 CORS 허용 목록이 이 origin을 전제로 한다.
        androidScheme: 'https',
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
