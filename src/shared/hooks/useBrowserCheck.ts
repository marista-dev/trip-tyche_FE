import { useState, useEffect } from 'react';

import { isNative } from '@/platform';

const useBrowserCheck = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        // 네이티브 앱의 WebView도 UA에 'android'를 담고 있어, 가드가 없으면 앱 실행마다 경고가 뜬다.
        // 이 안내는 안드로이드 '브라우저' 사용자를 앱으로 유도하기 위한 것이므로 앱 안에서는 불필요하다.
        if (isNative()) return;

        const userAgent = navigator.userAgent.toLowerCase();
        const isAndroidBrowser = userAgent.includes('android');

        if (isAndroidBrowser) {
            setIsModalOpen(true);
        }
    }, []);

    const closeModal = () => {
        setIsModalOpen(false);
    };

    return {
        isModalOpen,
        closeModal,
    };
};

export default useBrowserCheck;
