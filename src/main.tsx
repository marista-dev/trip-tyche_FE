// import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { initAppShell } from '@/platform/native/appShell';

// 네이티브 셸 초기화(상태바·백버튼·스플래시). 웹에서는 즉시 반환된다.
// 렌더를 막지 않도록 await하지 않는다 — 실패해도 앱은 그대로 뜬다.
void initAppShell();

createRoot(document.getElementById('root')!).render(
    // <StrictMode>
    <App />,
    // </StrictMode>
);
