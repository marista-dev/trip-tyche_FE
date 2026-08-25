import { useEffect, useState } from 'react';

import { Browser } from '@capacitor/browser';

import { checkAppUpdate, type UpdateStatus } from '@/platform/native/appUpdate';
import ConfirmModal from '@/shared/components/common/Modal/ConfirmModal';

/*
 * 앱 업데이트 안내.
 *
 * 스토어 배포가 아니라 링크에서 APK를 직접 받는 방식이라 자동 업데이트가 없다.
 * 구버전이 남아 API가 바뀌면 조용히 깨지므로 앱이 스스로 확인한다.
 *
 *   required — 서버가 지원을 끊은 버전. 닫을 수 없다
 *   optional — 새 버전이 있음. 한 번 닫으면 이 세션에서는 다시 뜨지 않는다
 *
 * 웹에서는 checkAppUpdate가 즉시 ok를 반환하므로 아무것도 렌더하지 않는다.
 */
const AppUpdateGate = () => {
    const [status, setStatus] = useState<UpdateStatus>({ kind: 'ok' });
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        void checkAppUpdate().then(setStatus);
    }, []);

    if (status.kind === 'ok') return null;
    if (status.kind === 'optional' && dismissed) return null;

    const isRequired = status.kind === 'required';

    const openDownloadPage = () => {
        // 시스템 브라우저로 연다. WebView에서 열면 앱 화면이 대체돼 돌아올 수 없다.
        void Browser.open({ url: status.updateUrl });
    };

    // ConfirmModal이 내부에서 Modal을 렌더하므로 여기서 다시 감싸지 않는다.
    return (
        <ConfirmModal
            title={isRequired ? '업데이트가 필요해요' : '새 버전이 있어요'}
            description={
                isRequired
                    ? `현재 버전은 더 이상 지원되지 않아요. ${status.latestVersion} 버전을 내려받아 주세요.`
                    : `${status.latestVersion} 버전을 내려받을 수 있어요.`
            }
            confirmText='내려받기'
            cancelText={isRequired ? undefined : '나중에'}
            confirmModal={openDownloadPage}
            closeModal={isRequired ? undefined : () => setDismissed(true)}
        />
    );
};

export default AppUpdateGate;
