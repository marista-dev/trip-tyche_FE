import { useEffect, useState } from 'react';

import { isNative } from '@/platform';
import { useAppDownloadUrl } from '@/shared/hooks/useAppDownloadUrl';

/*
 * 안드로이드 웹 사용자에게 앱 설치를 안내한다.
 *
 * 안드로이드 브라우저는 사진 업로드 시 시스템이 EXIF의 GPS를 제거한다.
 * 이 서비스는 사진 좌표로 지도에 핀을 찍으므로, 안드로이드 웹에서는 핵심 기능이 동작하지 않는다.
 * 앱은 ACCESS_MEDIA_LOCATION 권한으로 원본 EXIF를 읽을 수 있어 이 문제가 없다.
 *
 * 표시 조건 — 넷 다 만족해야 한다.
 *   1) 네이티브 앱이 아님 (앱 안에서 앱 설치를 권할 이유가 없다)
 *   2) 안드로이드 브라우저
 *   3) 로그인 상태 (가입 전에 설치를 요구하면 이탈한다)
 *   4) 이전에 닫지 않음
 */

const DISMISS_KEY = 'triptyche.androidAppPrompt.dismissed';

export const isAndroidBrowser = () => !isNative() && navigator.userAgent.toLowerCase().includes('android');

const wasDismissed = () => {
    try {
        return localStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
        // 시크릿 모드 등에서 localStorage 접근이 막힐 수 있다. 그때는 매번 보여준다.
        return false;
    }
};

export const useAndroidAppPrompt = (isAuthenticated: boolean) => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!isAndroidBrowser() || !isAuthenticated || wasDismissed()) return;
        setIsOpen(true);
    }, [isAuthenticated]);

    const downloadUrl = useAppDownloadUrl(isOpen);

    // 한 번 닫으면 다시 띄우지 않는다. 매번 뜨면 안내가 아니라 방해다.
    const dismiss = () => {
        setIsOpen(false);
        try {
            localStorage.setItem(DISMISS_KEY, 'true');
        } catch {
            // 저장 실패는 무시한다. 다음 방문에 다시 뜰 뿐이다.
        }
    };

    return { isOpen, downloadUrl, dismiss };
};
