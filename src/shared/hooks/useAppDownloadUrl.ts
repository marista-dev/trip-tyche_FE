import { useEffect, useState } from 'react';

import axios from 'axios';

import { API_BASE_URL } from '@/libs/apis/shared/constants';

/*
 * APK 다운로드 주소. 서버가 /v1/app/config로 관리하므로 배포 위치가 바뀌어도 앱 수정이 필요 없다.
 * 조회가 끝나기 전에는 null이다. 그 전에 설치 버튼을 열면 홈페이지로 가므로 호출부가 기다린다.
 * 조회에 실패하면 서비스 홈으로 보낸다 — 안내 자체를 막지 않기 위해서다.
 */
const FALLBACK_DOWNLOAD_URL = 'https://triptyche.cloud';

export const useAppDownloadUrl = (enabled: boolean) => {
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;

        void axios
            .get(`${API_BASE_URL}/v1/app/config`, { timeout: 5000 })
            .then(({ data }) => {
                const url = data?.data?.updateUrl;
                if (!cancelled) setDownloadUrl(url || FALLBACK_DOWNLOAD_URL);
            })
            .catch(() => {
                if (!cancelled) setDownloadUrl(FALLBACK_DOWNLOAD_URL);
            });

        return () => {
            cancelled = true;
        };
    }, [enabled]);

    return downloadUrl;
};
