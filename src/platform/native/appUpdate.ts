import axios from 'axios';

import { API_BASE_URL } from '@/libs/apis/shared/constants';
import { isNative } from '@/platform';
import { APP_VERSION_NAME } from '@/platform/native/appVersion';

/*
 * 앱 업데이트 확인.
 *
 * 스토어 배포가 아니라 링크에서 APK를 직접 받는 방식이라 자동 업데이트가 없다.
 * 구버전이 계속 남아 API가 바뀌면 조용히 깨지므로, 앱이 스스로 확인해 안내한다.
 */

export type UpdateStatus =
    | { kind: 'ok' }
    | { kind: 'optional'; latestVersion: string; updateUrl: string }
    | { kind: 'required'; latestVersion: string; updateUrl: string };

interface AppConfig {
    minSupportedVersion: string;
    latestVersion: string;
    updateUrl: string;
}

/*
 * semver 비교. a < b 이면 음수.
 * 자리수가 달라도(1.0 vs 1.0.0) 빠진 자리를 0으로 채워 비교한다.
 */
const compareVersions = (a: string, b: string): number => {
    const parse = (v: string) => v.split('.').map((n) => Number.parseInt(n, 10) || 0);
    const [left, right] = [parse(a), parse(b)];
    const length = Math.max(left.length, right.length);

    for (let i = 0; i < length; i++) {
        const diff = (left[i] ?? 0) - (right[i] ?? 0);
        if (diff !== 0) return diff;
    }

    return 0;
};

export const checkAppUpdate = async (): Promise<UpdateStatus> => {
    if (!isNative()) return { kind: 'ok' };

    let config: AppConfig;

    try {
        const { data } = await axios.get(`${API_BASE_URL}/v1/app/config`, { timeout: 5000 });
        config = data?.data;
        if (!config?.latestVersion) return { kind: 'ok' };
    } catch {
        /*
         * 네트워크 실패는 조용히 통과시킨다.
         * 업데이트 "확인"이 실패했다고 앱 사용을 막으면, 서버 장애가 전체 사용 불가로 번진다.
         */
        return { kind: 'ok' };
    }

    const { minSupportedVersion, latestVersion, updateUrl } = config;

    if (minSupportedVersion && compareVersions(APP_VERSION_NAME, minSupportedVersion) < 0) {
        return { kind: 'required', latestVersion, updateUrl };
    }

    if (compareVersions(APP_VERSION_NAME, latestVersion) < 0) {
        return { kind: 'optional', latestVersion, updateUrl };
    }

    return { kind: 'ok' };
};

// 테스트용으로만 노출한다.
export const __compareVersions = compareVersions;
