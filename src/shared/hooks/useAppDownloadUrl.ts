import { useEffect, useState } from 'react';

import axios from 'axios';

import { API_BASE_URL } from '@/libs/apis/shared/constants';

/*
 * APK 다운로드 주소. 서버가 /v1/app/config로 관리하므로 배포 위치가 바뀌어도 앱 수정이 필요 없다.
 * 조회에 실패하면 서비스 홈으로 보낸다 — 안내 자체를 막지 않기 위해서다.
 */
const FALLBACK_DOWNLOAD_URL = 'https://triptyche.cloud';

export const useAppDownloadUrl = (enabled: boolean) => {
    const [downloadUrl, setDownloadUrl] = useState(FALLBACK_DOWNLOAD_URL);

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;

        void axios
            .get(`${API_BASE_URL}/v1/app/config`, { timeout: 5000 })
            .then(({ data }) => {
                const url = data?.data?.updateUrl;
                if (!cancelled && url) setDownloadUrl(url);
            })
            .catch(() => undefined);

        return () => {
            cancelled = true;
        };
    }, [enabled]);

    return downloadUrl;
};
