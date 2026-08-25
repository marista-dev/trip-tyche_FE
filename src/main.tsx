// import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { initAppShell } from '@/platform/native/appShell';

const render = () => {
    createRoot(document.getElementById('root')!).render(
        // <StrictMode>
        <App />,
        // </StrictMode>
    );
};

/*
 * 네이티브 셸 초기화(저장된 토큰 복원, 상태바, 백버튼, 스플래시). 웹에서는 즉시 반환된다.
 *
 * 렌더보다 먼저 끝나야 하는 이유: 저장된 토큰이 메모리에 올라오기 전에 첫 API 요청이 나가면
 * 인증 헤더 없이 401을 받고 로그인 화면으로 튕긴다.
 * 초기화가 실패하더라도 앱 자체는 떠야 하므로 실패를 삼키고 렌더한다.
 */
initAppShell()
    .catch((error) => console.warn('앱 셸 초기화 실패: ', error))
    .finally(render);
