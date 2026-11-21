import { QueryClient, QueryKey } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';

import { invalidateTripMedia } from '@/domains/media/queryKeys';
import { invalidateTripLists, tripKeys } from '@/domains/trip/queryKeys';
import { userKeys } from '@/domains/user/queryKeys';

/*
 * 마이 페이지 통계(userKeys.stats)는 여행·사진이 바뀔 때마다 낡아야 한다.
 * 호출부마다 키를 챙기지 않고 invalidateTripLists / invalidateTripMedia 한 곳에서 처리하는지 확인한다.
 */

const SEEDED: QueryKey[] = [tripKeys.ticketList, tripKeys.summaryList, userKeys.stats, ['summary']];

let client = new QueryClient();

const seed = () => {
    client = new QueryClient();
    SEEDED.forEach((key) => client.setQueryData(key, { success: true }));
};

const invalidatedKeys = () =>
    client
        .getQueryCache()
        .getAll()
        .filter((query) => query.state.isInvalidated)
        .map((query) => query.queryKey);

afterEach(() => client.clear());

describe('통계 쿼리 무효화', () => {
    it('통계 키 값을 유지한다', () => {
        expect(userKeys.stats).toEqual(['user-stats']);
    });

    it('invalidateTripLists는 티켓 목록·지구본 목록과 마이 페이지 통계를 무효화한다', async () => {
        seed();
        await invalidateTripLists(client);
        expect(invalidatedKeys()).toEqual([tripKeys.ticketList, tripKeys.summaryList, userKeys.stats]);
    });

    it('invalidateTripMedia도 사진이 바뀌면 통계를 무효화한다', async () => {
        seed();
        await invalidateTripMedia(client, 'trip-a');
        expect(invalidatedKeys()).toContainEqual(userKeys.stats);
    });

    it('통계와 무관한 summary 키는 건드리지 않는다', async () => {
        seed();
        await invalidateTripLists(client);
        expect(invalidatedKeys()).not.toContainEqual(['summary']);
    });
});
