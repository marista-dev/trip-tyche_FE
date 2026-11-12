import { useEffect, useRef } from 'react';

const MARKER = '__ticketRing';

/**
 * 열려 있는 동안 히스토리 항목을 하나 쌓아, 뒤로가기(안드로이드 하드웨어 백버튼 포함)가 페이지 이탈 대신 닫기가 되게 한다.
 * appShell의 백버튼은 history.back()을 부르므로 같은 경로로 처리된다.
 * react-router가 쓰는 history.state(idx·key)는 그대로 둔 채 표시만 덧붙인다.
 *
 * 반환값: UI로 닫을 때 쓰는 함수 — 쌓아 둔 항목을 걷어낸 뒤 onClose가 불린다.
 */
export const useHistoryBackClose = (open: boolean, onClose: () => void) => {
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const pushedRef = useRef(false);

    useEffect(() => {
        if (!open) return;
        window.history.pushState({ ...(window.history.state ?? {}), [MARKER]: true }, '');
        pushedRef.current = true;
        const onPop = () => {
            if (!pushedRef.current) return;
            pushedRef.current = false;
            onCloseRef.current();
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, [open]);

    /** 화면 안에서 닫기 — 쌓은 항목이 있으면 back으로 걷어내고, popstate에서 onClose가 불린다 */
    const requestClose = () => {
        if (pushedRef.current && window.history.state?.[MARKER]) {
            window.history.back();
            return;
        }
        pushedRef.current = false;
        onCloseRef.current();
    };

    /** 다른 페이지로 이동하기 전 — 쌓은 항목을 남기지 않고 표시만 지운다(replace 이동과 함께 쓴다) */
    const release = () => {
        pushedRef.current = false;
    };

    return { requestClose, release };
};
