import { act, createElement, useState } from 'react';

import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isUploadInProgress, useUploadGuard } from '@/domains/media/hooks/useUploadGuard';

/*
 * 업로드 중 화면 이탈 차단과 꺼짐 방지. useBlocker는 데이터 라우터 안에서만 동작해 메모리 라우터로 띄운다.
 * @testing-library/dom이 설치돼 있지 않아 렌더를 직접 한다(useImageUpload.test.ts와 같은 방식).
 */

type Guard = ReturnType<typeof useUploadGuard>;

const mountGuard = (initialActive: boolean, history = { initialEntries: ['/upload'], initialIndex: 0 }) => {
    const handle = {} as { guard: Guard; setActive: (active: boolean) => void };
    const Probe = () => {
        const [active, setActive] = useState(initialActive);
        handle.guard = useUploadGuard(active);
        handle.setActive = setActive;
        return null;
    };
    const router = createMemoryRouter(
        [
            { path: '/upload', element: createElement(Probe) },
            { path: '/other', element: null },
        ],
        history,
    );
    act(() => {
        createRoot(document.createElement('div')).render(createElement(RouterProvider, { router }));
    });
    return { handle, router };
};

const navigateAway = async (router: ReturnType<typeof createMemoryRouter>) => {
    await act(async () => {
        await router.navigate('/other');
    });
};

describe('isUploadInProgress', () => {
    it('떠나면 진행을 잃는 단계만 true다', () => {
        expect(
            ['preparing', 'uploading', 'registering', 'finalizing'].every((p) => isUploadInProgress(p as never)),
        ).toBe(true);
        expect(['idle', 'done', 'failed'].some((p) => isUploadInProgress(p as never))).toBe(false);
    });
});

describe('useUploadGuard 이탈 차단', () => {
    it('업로드 중이 아니면 막지 않는다', async () => {
        const { handle, router } = mountGuard(false);
        await navigateAway(router);
        expect(router.state.location.pathname).toBe('/other');
        expect(handle.guard).toBeDefined();
    });

    it('업로드 중 이동은 막고, 머물기를 고르면 그대로 남는다', async () => {
        const { handle, router } = mountGuard(true);
        await navigateAway(router);
        expect(router.state.location.pathname).toBe('/upload');
        expect(handle.guard.isLeaveBlocked).toBe(true);

        act(() => handle.guard.stay());
        expect(handle.guard.isLeaveBlocked).toBe(false);
        expect(router.state.location.pathname).toBe('/upload');
    });

    // Android 하드웨어 뒤로가기는 history.back()이라 POP 이동으로 들어온다(appShell.ts)
    it('뒤로가기(POP)도 막는다', async () => {
        const { handle, router } = mountGuard(true, { initialEntries: ['/other', '/upload'], initialIndex: 1 });
        await act(async () => {
            await router.navigate(-1);
        });
        expect(router.state.location.pathname).toBe('/upload');
        expect(handle.guard.isLeaveBlocked).toBe(true);
    });

    it('나가기를 고르면 막았던 이동을 이어 간다', async () => {
        const { handle, router } = mountGuard(true);
        await navigateAway(router);
        await act(async () => handle.guard.leave());
        expect(router.state.location.pathname).toBe('/other');
    });

    it('묻는 사이 업로드가 끝나면 막았던 이동을 이어 간다', async () => {
        const { handle, router } = mountGuard(true);
        await navigateAway(router);
        expect(handle.guard.isLeaveBlocked).toBe(true);
        await act(async () => handle.setActive(false));
        expect(router.state.location.pathname).toBe('/other');
    });
});

describe('useUploadGuard 화면 꺼짐 방지', () => {
    const release = vi.fn(() => Promise.resolve());
    const request = vi.fn();
    let visibility: DocumentVisibilityState = 'visible';

    beforeEach(() => {
        release.mockClear();
        request.mockReset();
        request.mockImplementation(() => {
            const sentinel = { released: false, release: () => ((sentinel.released = true), release()) };
            return Promise.resolve(sentinel);
        });
        visibility = 'visible';
        Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
        Object.defineProperty(document, 'visibilityState', { get: () => visibility, configurable: true });
    });

    afterEach(() => {
        delete (navigator as { wakeLock?: unknown }).wakeLock;
        delete (document as { visibilityState?: unknown }).visibilityState;
    });

    it('업로드 중에만 잠금을 잡고, 끝나면 놓는다', async () => {
        const { handle } = mountGuard(false);
        expect(request).not.toHaveBeenCalled();

        await act(async () => handle.setActive(true));
        expect(request).toHaveBeenCalledWith('screen');

        await act(async () => handle.setActive(false));
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('가려졌다 돌아오면 브라우저가 푼 잠금을 다시 잡는다', async () => {
        mountGuard(true);
        await act(async () => {});
        expect(request).toHaveBeenCalledTimes(1);
        const [sentinel] = await Promise.all(request.mock.results.map((r) => r.value));
        sentinel.released = true;

        visibility = 'visible';
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
        expect(request).toHaveBeenCalledTimes(2);
    });

    it('잠금 요청이 거부돼도 던지지 않는다', async () => {
        request.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
        const { handle } = mountGuard(true);
        await act(async () => {});
        expect(handle.guard.isLeaveBlocked).toBe(false);
    });
});
