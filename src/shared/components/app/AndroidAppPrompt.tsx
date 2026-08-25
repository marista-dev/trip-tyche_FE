import useUserStore from '@/domains/user/stores/useUserStore';
import ConfirmModal from '@/shared/components/common/Modal/ConfirmModal';
import { useAndroidAppPrompt } from '@/shared/hooks/useAndroidAppPrompt';

/*
 * 안드로이드 웹 사용자에게 앱 설치를 안내한다.
 *
 * 안드로이드 브라우저는 사진 업로드 시 EXIF의 GPS를 제거해, 이 서비스의 핵심인
 * '사진 위치로 지도에 핀 찍기'가 동작하지 않는다. 앱에서는 원본 EXIF를 읽을 수 있다.
 *
 * 로그인 직후에 뜬다. 가입 전에 설치를 요구하면 이탈하기 때문이다.
 */
const AndroidAppPrompt = () => {
    const status = useUserStore((s) => s.status);
    const { isOpen, downloadUrl, dismiss } = useAndroidAppPrompt(status === 'authenticated');

    if (!isOpen) return null;

    return (
        <ConfirmModal
            title='앱으로 더 정확하게'
            description={
                '안드로이드 브라우저에서는 사진을 올릴 때 위치 정보가 지워져요.\n' +
                '앱을 설치하면 사진에 담긴 위치가 그대로 지도에 표시됩니다.'
            }
            confirmText='앱 설치하기'
            cancelText='웹으로 볼게요'
            confirmModal={() => {
                window.open(downloadUrl, '_blank', 'noopener,noreferrer');
                dismiss();
            }}
            closeModal={dismiss}
        />
    );
};

export default AndroidAppPrompt;
