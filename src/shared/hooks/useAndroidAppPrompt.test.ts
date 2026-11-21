import { act, createElement } from 'react';

import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * 안드로이드 웹은 로그인과 무관하게 접속하자마자 앱 설치를 안내하고, 닫으면 이번 방문 동안만 숨긴다.
 * @testing-library/dom이 없어 렌더를 직접 한다(useUploadGuard.test.ts와 같은 방식).
 */

let androidWeb = true;
// 조회가 끝나기 전(null)과 끝난 뒤를 바꿔 가며 본다. 조회는 열 자격이 있을 때만 한다.
let resolvedUrl: string | null = 'https://download';
vi.mock('@/platform', () => ({ isAndroidWeb: () => androidWeb }));
vi.mock('@/shared/hooks/useAppDownloadUrl', () => ({
    useAppDownloadUrl: (enabled: boolean) => (enabled ? resolvedUrl : null),
}));

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
    resolvedUrl = 'https://download';
});

describe('useAndroidAppPrompt', () => {
    it('안드로이드 웹이면 다운로드 주소를 받는 대로 연다', () => {
        const { prompt } = mount();
        expect(prompt.isOpen).toBe(true);
        expect(prompt.downloadUrl).toBe('https://download');
    });

    it('다운로드 주소를 받기 전에는 열지 않는다(누르면 홈페이지로 가지 않게)', () => {
        resolvedUrl = null;
        expect(mount().prompt.isOpen).toBe(false);
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
