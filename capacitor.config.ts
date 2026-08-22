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
};

export default config;
