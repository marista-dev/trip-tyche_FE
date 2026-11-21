import { act, createElement } from 'react';

import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * 안드로이드 웹은 로그인과 무관하게 접속하자마자 앱 설치를 안내하고, 닫으면 이번 방문 동안만 숨긴다.
 * @testing-library/dom이 없어 렌더를 직접 한다(useUploadGuard.test.ts와 같은 방식).
 */

let androidWeb = true;
vi.mock('@/platform', () => ({ isAndroidWeb: () => androidWeb }));
vi.mock('@/shared/hooks/useAppDownloadUrl', () => ({ useAppDownloadUrl: () => 'https://download' }));

const { useAndroidAppPrompt } = await import('@/shared/hooks/useAndroidAppPrompt');

type Prompt = ReturnType<typeof useAndroidAppPrompt>;

const mount = () => {
    const handle = {} as { prompt: Prompt };
    const Probe = () => {
        handle.prompt = useAndroidAppPrompt();
        return null;
    };
    act(() => {
        createRoot(document.createElement('div')).render(createElement(Probe));
    });
    return handle;
};

afterEach(() => {
    sessionStorage.clear();
    androidWeb = true;
});

describe('useAndroidAppPrompt', () => {
    it('안드로이드 웹이면 바로 연다', () => {
        expect(mount().prompt.isOpen).toBe(true);
    });

    it('안드로이드 웹이 아니면 열지 않는다', () => {
        androidWeb = false;
        expect(mount().prompt.isOpen).toBe(false);
    });

    it('닫으면 이번 방문 동안은 다시 열지 않고, 새 방문에는 다시 연다', () => {
        const first = mount();
        act(() => first.prompt.dismiss());
        expect(first.prompt.isOpen).toBe(false);
        expect(mount().prompt.isOpen).toBe(false);

        sessionStorage.clear();
        expect(mount().prompt.isOpen).toBe(true);
    });
});
