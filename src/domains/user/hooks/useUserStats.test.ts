import { act, createElement, type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { userKeys } from '@/domains/user/queryKeys';
import type { UserStats } from '@/domains/user/types';

/*
 * 마이 페이지 통계는 서버 응답 1번으로 끝나야 한다(여행 수만큼 media-files를 부르던 N+1 제거).
 * 로딩·실패 때는 숫자가 0으로 보이지 않도록 isLoading/isError를 정확히 내려주는지도 본다.
 */

const userAPIMock = { fetchUserStats: vi.fn() };
vi.mock('@/libs/apis', () => ({ userAPI: userAPIMock }));

const { useUserStats } = await import('@/domains/user/hooks/useUserStats');

const STATS: UserStats = {
    tripsCount: 2,
    totalPhotos: 5,
    locatedPhotos: 3,
    unlocatedPhotos: 2,
    countriesCount: 1,
    mostPhotographedDay: { date: '2024-03-02', count: 3, label: '일본' },
    byTrip: [
        { tripKey: 'K1', tripTitle: '도쿄', startDate: '2024-03-01', endDate: '2024-03-05', photoCount: 5 },
        { tripKey: 'K2', tripTitle: '빈 여행', startDate: '2024-05-01', endDate: '2024-05-03', photoCount: 0 },
    ],
    byCountry: [{ country: '🇯🇵/일본/JAPAN', emoji: '🇯🇵', name: '일본', visits: 2, photoCount: 5 }],
};

// @testing-library/dom이 설치돼 있지 않아 renderHook을 직접 만든다(useImageUpload.test.ts와 같은 방식).
const renderHook = <T>(useHook: () => T, client: QueryClient) => {
    const result = {} as { current: T };
    const Probe = () => {
        result.current = useHook();
        return null;
    };
    const wrapper = (children: ReactNode) => createElement(QueryClientProvider, { client }, children);
    const container = document.createElement('div');
    act(() => {
        createRoot(container).render(wrapper(createElement(Probe)));
    });
    return { result };
};

// 요청이 끝날 때까지 기다린 뒤, 완료 알림(notifyManager가 setTimeout 0으로 미룬다)까지 비워 렌더에 반영시킨다.
const settle = () =>
    act(async () => {
        await vi.waitUntil(() => client.isFetching() === 0, { interval: 1 });
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
    });

let client: QueryClient;

beforeEach(() => {
    userAPIMock.fetchUserStats.mockReset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe('useUserStats', () => {
    it('응답 전에는 빈 통계와 isLoading=true를 돌려준다', () => {
        userAPIMock.fetchUserStats.mockReturnValue(new Promise(() => {}));

        const { result } = renderHook(() => useUserStats(), client);

        expect(result.current.isLoading).toBe(true);
        expect(result.current.isError).toBe(false);
        expect(result.current.stats).toMatchObject({
            tripsCount: 0,
            totalPhotos: 0,
            countriesCount: 0,
            mostPhotographedDay: null,
            byTrip: [],
            byCountry: [],
        });
    });

    it('API 한 번으로 받은 통계를 가공 없이 그대로 돌려준다', async () => {
        userAPIMock.fetchUserStats.mockResolvedValue({ data: STATS });

        const { result } = renderHook(() => useUserStats(), client);
        await settle();

        expect(userAPIMock.fetchUserStats).toHaveBeenCalledTimes(1);
        expect(result.current).toEqual({ stats: STATS, isLoading: false, isError: false });
    });

    it('사진이 없는 계정의 mostPhotographedDay: null을 그대로 유지한다', async () => {
        const empty: UserStats = { ...STATS, totalPhotos: 0, mostPhotographedDay: null };
        userAPIMock.fetchUserStats.mockResolvedValue({ data: empty });

        const { result } = renderHook(() => useUserStats(), client);
        await settle();

        expect(result.current.stats.mostPhotographedDay).toBeNull();
        expect(result.current.isError).toBe(false);
    });

    it('요청이 실패하면 빈 통계와 isError=true를 돌려준다', async () => {
        userAPIMock.fetchUserStats.mockRejectedValue(new Error('network'));

        const { result } = renderHook(() => useUserStats(), client);
        await settle();

        expect(result.current.isLoading).toBe(false);
        expect(result.current.isError).toBe(true);
        expect(result.current.stats.tripsCount).toBe(0);
    });

    it('실패 결과는 캐시에 남아도 낡은 것으로 취급해 다음 마운트에서 다시 받는다', async () => {
        userAPIMock.fetchUserStats.mockRejectedValueOnce(new Error('network'));
        const first = renderHook(() => useUserStats(), client);
        await settle();
        expect(first.result.current.isError).toBe(true);

        userAPIMock.fetchUserStats.mockResolvedValue({ data: STATS });
        const second = renderHook(() => useUserStats(), client);
        await settle();

        expect(userAPIMock.fetchUserStats).toHaveBeenCalledTimes(2);
        expect(second.result.current.stats).toEqual(STATS);
    });

    it('성공한 결과는 staleTime 동안 재사용하고, 키가 무효화되면 다시 받는다', async () => {
        userAPIMock.fetchUserStats.mockResolvedValue({ data: STATS });
        renderHook(() => useUserStats(), client);
        await settle();

        renderHook(() => useUserStats(), client);
        await settle();
        expect(userAPIMock.fetchUserStats).toHaveBeenCalledTimes(1);

        await act(async () => {
            await client.invalidateQueries({ queryKey: userKeys.stats });
        });
        expect(userAPIMock.fetchUserStats).toHaveBeenCalledTimes(2);
    });
});
