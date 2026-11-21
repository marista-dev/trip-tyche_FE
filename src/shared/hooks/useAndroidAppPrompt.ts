import { useEffect, useState } from 'react';

import { isAndroidWeb } from '@/platform';
import { useAppDownloadUrl } from '@/shared/hooks/useAppDownloadUrl';

/*
 * 안드로이드 웹 사용자에게 접속하자마자 앱 설치를 안내한다.
 *
 * 안드로이드 브라우저는 사진 업로드 때 EXIF의 GPS를 지우고, 일부 사진은 업로드 자체가 끊기기도 한다.
 * 이 서비스는 사진 좌표로 지도에 핀을 찍으므로 앱(원본 EXIF를 읽음)으로 유도한다.
 *
 * 닫으면 이번 방문(탭 세션) 동안만 다시 띄우지 않는다. 영구히 숨기면 한 번 닫은 사용자가
 * 계속 웹으로 올리게 되고, 방문마다 한 번이면 같은 방문 안에서 반복해 방해하지 않는다.
 */

const DISMISS_KEY = 'triptyche.androidAppPrompt.dismissed';

const wasDismissed = () => {
    try {
        return sessionStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
        // 시크릿 모드 등에서 저장소 접근이 막힐 수 있다. 그때는 화면을 새로 열 때마다 보여준다.
        return false;
    }
};

export const useAndroidAppPrompt = () => {
    const [isEligible, setIsEligible] = useState(false);

    useEffect(() => {
        if (!isAndroidWeb() || wasDismissed()) return;
        setIsEligible(true);
    }, []);

    // 접속 직후라 주소 조회가 끝나기 전에 누를 수 있다. 주소를 받은 뒤에 연다.
    const downloadUrl = useAppDownloadUrl(isEligible);
    const isOpen = isEligible && downloadUrl !== null;

    const dismiss = () => {
        setIsEligible(false);
        try {
            sessionStorage.setItem(DISMISS_KEY, 'true');
        } catch {
            // 저장 실패는 무시한다. 새로 열 때 다시 뜰 뿐이다.
        }
    };

    return { isOpen, downloadUrl: downloadUrl ?? '', dismiss };
};
