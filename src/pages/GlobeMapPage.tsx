/* GlobeMapPage — 로그인 후 메인 랜딩 페이지
   Design: design_handoff_globe_home/README.md
   empty:     회색 지구본 + CTA 카드 슬라이드업 (터치 후 0.4s idle)
   populated: 파란 핀 + 하단 티켓 진입 버튼, 핀을 탭하면 그 나라 티켓 오빗 링
   씬(Three.js)은 GlobeScene, 링은 ticketRing/ 에 있고 이 파일은 데이터·상태 연결만 맡는다.
*/
import { useEffect, useMemo, useRef, useState } from 'react';

import { css } from '@emotion/react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { EmptyTripCta, TicketEntryButton } from '@/domains/trip/components/globe/GlobeBottomCard';
import { groupTripsByCountry } from '@/domains/trip/components/globe/globeGeo';
import { GlobeHeader, GlobeHint, GlobeLoading } from '@/domains/trip/components/globe/GlobeHud';
import { markCoversResolved } from '@/domains/trip/components/globe/ticketRing/coverTiming';
import { sortLatestFirst, toRingTickets } from '@/domains/trip/components/globe/ticketRing/ringTickets';
import TicketRingCaption from '@/domains/trip/components/globe/ticketRing/TicketRingCaption';
import { useHistoryBackClose } from '@/domains/trip/components/globe/ticketRing/useHistoryBackClose';
import { useTicketRingCovers } from '@/domains/trip/components/globe/ticketRing/useTicketRingCovers';
import { useGlobeScene } from '@/domains/trip/components/globe/useGlobeScene';
import { useTripSummaryList } from '@/domains/trip/hooks/queries';
import { TripSummary } from '@/domains/trip/types';
import NicknameSetupOverlay from '@/domains/user/components/NicknameSetupOverlay';
import { useSummary } from '@/domains/user/hooks/queries';
import { useMemberOnly } from '@/domains/user/hooks/useMemberOnly';
import useUserStore from '@/domains/user/stores/useUserStore';
import { ANALYTICS_EVENTS, track } from '@/libs/analytics';
import { routeAPI, tripAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';
import { ROUTES } from '@/shared/constants/route';
import { useToastStore } from '@/shared/stores/useToastStore';

const EMPTY_TRIPS: TripSummary[] = [];
/** 지구본에서 손을 떼고 이만큼 지나면 하단 카드가 올라온다 */
const CTA_IDLE_MS = 400;

const GlobeMapPage = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const showToast = useToastStore((s) => s.showToast);
    const requireMember = useMemberOnly();

    /* data */
    const { data: summaryResult, isLoading: isSummaryLoading } = useSummary();
    const shouldFetchTrips = !!(summaryResult?.success && summaryResult.data);
    const { data: tripsResult, isLoading: isTripsLoading } = useTripSummaryList(shouldFetchTrips);
    const isLoading = isSummaryLoading || (shouldFetchTrips && isTripsLoading);
    const trips: TripSummary[] = tripsResult?.success
        ? (tripsResult as { success: true; data: TripSummary[] }).data
        : EMPTY_TRIPS;

    const globeState = isLoading ? 'loading' : trips.length === 0 ? 'empty' : 'populated';
    const nickname = summaryResult?.success ? summaryResult.data.nickname : '';
    const showNicknameSetup = summaryResult?.success && !summaryResult.data.nickname;

    const login = useUserStore((state) => state.login);
    useEffect(() => {
        // 인증 실패 처리는 interceptor + RequireAuth가 책임진다.
        // 여기서는 성공 시에만 store를 최신 데이터로 동기화한다 (닉네임 업데이트 등).
        if (summaryResult?.success) {
            login(summaryResult.data);
        }
    }, [summaryResult, login]);

    const tripsByCountry = useMemo(() => groupTripsByCountry(trips), [trips]);
    const visitedCountries = useMemo(() => [...tripsByCountry.keys()], [tripsByCountry]);

    /* 하단 카드(CTA·티켓 진입): 지구본을 놓고 잠시 뒤에만 보인다 */
    const [ctaReady, setCtaReady] = useState(false);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const armCta = () => {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => setCtaReady(true), CTA_IDLE_MS);
    };
    const disarmCta = () => {
        clearTimeout(idleTimerRef.current);
        setCtaReady(false);
    };
    // globeState가 바뀌면 리셋(자동 표시 없음 — 터치 후에만 표시)
    useEffect(() => {
        clearTimeout(idleTimerRef.current);
        setCtaReady(false);
    }, [globeState]);
    useEffect(() => () => clearTimeout(idleTimerRef.current), []);

    /* ─── 티켓 오빗 링 ─────────────────────────────────── */
    const [dotsReady, setDotsReady] = useState(false);
    /** 링에 올린 나라의 여행(최신순). null이면 링이 닫혀 있다 */
    const [ringTrips, setRingTrips] = useState<TripSummary[] | null>(null);
    const [activeTicket, setActiveTicket] = useState(0);
    const ringTripKeys = useMemo(() => (ringTrips ?? EMPTY_TRIPS).map((t) => t.tripKey), [ringTrips]);
    const { coverUrls, photoCounts } = useTicketRingCovers(ringTripKeys);
    const ringTickets = useMemo(
        () => toRingTickets(ringTrips ?? EMPTY_TRIPS, nickname, photoCounts),
        [ringTrips, nickname, photoCounts],
    );

    const closeRing = () => {
        sceneRef.current?.closeRing();
        setRingTrips(null);
        armCta();
    };
    // 안드로이드 백버튼·브라우저 뒤로가기 → 링 닫기
    const { requestClose: requestCloseRing, release: releaseRingHistory } = useHistoryBackClose(!!ringTrips, closeRing);

    const openRing = (nameEn: string) => {
        const sorted = sortLatestFirst(tripsByCountry.get(nameEn) ?? EMPTY_TRIPS);
        if (!sorted.length) return;
        setActiveTicket(0);
        setRingTrips(sorted);
        disarmCta();
        sceneRef.current?.openRing(nameEn, toRingTickets(sorted, nickname));
    };

    const openTicket = (index: number) => {
        const trip = ringTrips?.[index];
        if (!trip) return;
        queryClient.prefetchQuery({
            queryKey: ['route', trip.tripKey],
            queryFn: () => toResult(() => routeAPI.fetchTripRoute(trip.tripKey)),
        });
        // 링이 쌓은 히스토리 항목을 여행 페이지로 바꿔 끼운다 — 여행에서 뒤로 오면 바로 지구본
        releaseRingHistory();
        navigate(ROUTES.PATH.TRIP.ROOT(trip.tripKey), { replace: true });
    };

    const { mountRef, sceneRef } = useGlobeScene(visitedCountries, {
        onReady: () => setDotsReady(true),
        onPinTap: openRing,
        onTicketTap: openTicket,
        onRingDismiss: requestCloseRing,
        onActiveTicketChange: setActiveTicket,
        onGlobeTouchStart: disarmCta,
        onGlobeTouchEnd: armCta,
    });

    // 사진 수·커버가 도착하면 링 카드 텍스처를 갈아 끼운다(카드를 만들기 전이면 만들 때 반영)
    useEffect(() => {
        if (!ringTrips) return;
        markCoversResolved(coverUrls, photoCounts);
        sceneRef.current?.ring.updateTickets(ringTickets, coverUrls);
    }, [ringTrips, ringTickets, coverUrls, photoCounts, sceneRef]);

    const handleCreateFirst = async () => {
        const result = await toResult(() => tripAPI.createNewTrip());
        if (result.success) {
            // 여행 생성 퍼널 집계. 실패한 생성은 세지 않도록 success 분기 안에서만 보낸다.
            track(ANALYTICS_EVENTS.TRIP_CREATED);
            navigate(ROUTES.PATH.TRIP.NEW(result.data.tripKey!));
        } else {
            showToast(result.error);
        }
    };

    return (
        <div css={page}>
            {/* Three.js — transparent WebGL over CSS gradient */}
            <div ref={mountRef} css={canvas} />

            {globeState !== 'loading' && (
                <GlobeHeader state={globeState} countryCount={tripsByCountry.size} nickname={nickname} />
            )}

            {dotsReady && !ctaReady && !ringTrips && globeState !== 'loading' && <GlobeHint state={globeState} />}

            {globeState === 'empty' && dotsReady && (
                <EmptyTripCta visible={ctaReady} onCreate={() => requireMember('trip', handleCreateFirst)} />
            )}

            {globeState === 'populated' && !ringTrips && (
                <TicketEntryButton
                    visible={ctaReady}
                    ticketCount={trips.length}
                    onClick={() => navigate(ROUTES.PATH.TICKETS)}
                />
            )}

            {/* 핀을 탭하면 뜨는 티켓 오빗 링(WebGL)의 캡션 */}
            <TicketRingCaption tickets={ringTickets} activeIndex={activeTicket} visible={!!ringTrips} />

            {!dotsReady && <GlobeLoading />}

            {showNicknameSetup && <NicknameSetupOverlay />}
        </div>
    );
};

export default GlobeMapPage;

/* ════════════════════════════════════════════
   STYLES
════════════════════════════════════════════ */

/* page */
const page = css`
    position: relative;
    height: 100dvh;
    background: radial-gradient(ellipse at 50% 48%, #eef2ff 0%, #f8faff 50%, #ffffff 100%);
    overflow: hidden;
    font-family:
        'Outfit',
        -apple-system,
        sans-serif;
`;

const canvas = css`
    position: absolute;
    inset: 0;
    cursor: grab;
    &:active {
        cursor: grabbing;
    }
`;
