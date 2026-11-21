import { QueryClient, QueryKey } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';

import { invalidateTripMedia, mediaKeys } from '@/domains/media/queryKeys';
import { routeKeys } from '@/domains/route/queryKeys';
import { invalidateTripLists, tripKeys } from '@/domains/trip/queryKeys';
import { SUMMARY_QUERY_KEY, userKeys } from '@/domains/user/queryKeys';

const TRIP = 'trip-a';
const OTHER = 'trip-b';

const SEEDED: QueryKey[] = [
    tripKeys.ticketList,
    tripKeys.summaryList,
    tripKeys.info(TRIP),
    mediaKeys.tripImages(TRIP),
    mediaKeys.tripImages(OTHER),
    routeKeys.detail(TRIP),
    routeKeys.detail(OTHER),
    mediaKeys.byPinPoint(TRIP, '1'),
    mediaKeys.byPinPoint(TRIP, '2'),
    mediaKeys.byPinPoint(OTHER, '1'),
    mediaKeys.byDate(TRIP, '2024-01-01'),
    mediaKeys.byDate(OTHER, '2024-01-01'),
    SUMMARY_QUERY_KEY,
    userKeys.stats,
];

let client = new QueryClient();

// 옵저버 없는 시드 쿼리라 invalidate는 isInvalidated 표시만 남긴다(요청 없음)
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

describe('query key 값', () => {
    it('기존 문자열 키 값을 그대로 유지한다', () => {
        expect(tripKeys.ticketList).toEqual(['ticket-list']);
        expect(tripKeys.summaryList).toEqual(['trip-summary-list']);
        expect(tripKeys.info(TRIP)).toEqual(['ticket-info', TRIP]);
        expect(routeKeys.detail(TRIP)).toEqual(['route', TRIP]);
        expect(mediaKeys.tripImages(TRIP)).toEqual(['trip-images', TRIP]);
        expect(mediaKeys.byPinPoint(TRIP, '1')).toEqual(['media', 'by-pinPoint', TRIP, '1']);
        expect(mediaKeys.byDate(TRIP, '2024-01-01')).toEqual(['media', 'by-date', TRIP, '2024-01-01']);
    });
});

describe('invalidateTripLists', () => {
    it('티켓 목록·지구본 목록과 마이 페이지 통계만 무효화한다', async () => {
        seed();
        await invalidateTripLists(client);
        expect(invalidatedKeys()).toEqual([tripKeys.ticketList, tripKeys.summaryList, userKeys.stats]);
    });
});

describe('invalidateTripMedia', () => {
    it('그 여행의 사진·경로·핀별·날짜별 사진과 여행 목록·마이 페이지 통계를 무효화한다', async () => {
        seed();
        await invalidateTripMedia(client, TRIP);
        expect(invalidatedKeys()).toEqual(
            expect.arrayContaining([
                tripKeys.ticketList,
                tripKeys.summaryList,
                userKeys.stats,
                mediaKeys.tripImages(TRIP),
                routeKeys.detail(TRIP),
                mediaKeys.byPinPoint(TRIP, '1'),
                mediaKeys.byPinPoint(TRIP, '2'),
                mediaKeys.byDate(TRIP, '2024-01-01'),
            ]),
        );
        expect(invalidatedKeys()).toHaveLength(8);
    });

    it('다른 여행의 사진·경로와 여행 정보·summary는 건드리지 않는다', async () => {
        seed();
        await invalidateTripMedia(client, TRIP);
        const invalidated = invalidatedKeys();
        [
            mediaKeys.tripImages(OTHER),
            routeKeys.detail(OTHER),
            mediaKeys.byPinPoint(OTHER, '1'),
            mediaKeys.byDate(OTHER, '2024-01-01'),
            tripKeys.info(TRIP),
            SUMMARY_QUERY_KEY,
        ].forEach((key) => expect(invalidated).not.toContainEqual(key));
    });
});
