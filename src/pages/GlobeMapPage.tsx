/* GlobeMapPage — 로그인 후 메인 랜딩 페이지
   Design: design_handoff_globe_home/README.md
   empty:     회색 지구본 + CTA 카드 슬라이드업 (1.8s)
   populated: 파란 핀 + 하단 티켓 진입 버튼 (1.2s idle)
*/
import { useEffect, useMemo, useRef, useState } from 'react';

import { css, keyframes } from '@emotion/react';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { useTripImages } from '@/domains/media/hooks/queries';
import { useTripSummaryList } from '@/domains/trip/hooks/queries';
import { TripSummary } from '@/domains/trip/types';
import { NICKNAME_FORM } from '@/domains/user/constants';
import { useSummary } from '@/domains/user/hooks/queries';
import { useNickname } from '@/domains/user/hooks/useNickname';
import useUserStore from '@/domains/user/stores/useUserStore';
import { tripAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';
import { validateUserNickName } from '@/libs/utils/validate';
import { IMAGE_PLACEHOLDER } from '@/shared/constants/image';
import { ROUTES } from '@/shared/constants/route';
import { COLORS } from '@/shared/constants/style';
import { useToastStore } from '@/shared/stores/useToastStore';

/* ─── design tokens ─────────────────────────────────────── */
const { ACCENT } = COLORS;
const ACCENT_HEX = 0x0ea5e9; // COLORS.ACCENT('#0ea5e9')의 숫자 표현

/* ─── globe constants ───────────────────────────────────── */
const R = 0.78;
const DOT_STEP = 1.1;
const VISIT_RADIUS = 5;
const DOT_SIZE = 0.005;
const LAND_MASK_URL = '/earth-texture.jpg';

/* ─── country centroids ─────────────────────────────────── */
const CENTROIDS: Record<string, [number, number]> = {
    'SOUTH KOREA': [37.5, 127.0],
    KOREA: [37.5, 127.0],
    JAPAN: [36.2, 138.2],
    CHINA: [35.9, 104.2],
    TAIWAN: [23.7, 121.0],
    'HONG KONG': [22.4, 114.1],
    SINGAPORE: [1.3, 103.8],
    THAILAND: [15.9, 100.9],
    VIETNAM: [14.1, 108.3],
    INDONESIA: [-1.0, 116.5],
    MALAYSIA: [3.8, 108.5],
    PHILIPPINES: [12.5, 122.8],
    CAMBODIA: [12.6, 104.9],
    MYANMAR: [17.1, 96.9],
    LAOS: [17.6, 102.5],
    MONGOLIA: [46.9, 103.8],
    INDIA: [20.6, 78.9],
    'SRI LANKA': [7.9, 80.8],
    NEPAL: [28.4, 84.1],
    PAKISTAN: [30.4, 69.3],
    BANGLADESH: [23.7, 90.4],
    FRANCE: [46.2, 2.2],
    ITALY: [41.9, 12.6],
    SPAIN: [40.5, -3.7],
    GERMANY: [51.2, 10.5],
    'UNITED KINGDOM': [55.4, -3.4],
    UK: [55.4, -3.4],
    PORTUGAL: [39.4, -8.2],
    GREECE: [39.1, 21.8],
    NETHERLANDS: [52.1, 5.3],
    SWITZERLAND: [46.8, 8.2],
    AUSTRIA: [47.5, 14.6],
    BELGIUM: [50.5, 4.5],
    'CZECH REPUBLIC': [50.1, 15.5],
    HUNGARY: [47.2, 19.5],
    POLAND: [51.9, 19.1],
    CROATIA: [45.1, 15.2],
    NORWAY: [60.5, 8.5],
    SWEDEN: [60.1, 18.6],
    DENMARK: [56.3, 9.5],
    FINLAND: [61.9, 25.8],
    ICELAND: [64.9, -19.0],
    IRELAND: [53.4, -8.2],
    ROMANIA: [45.9, 24.9],
    UKRAINE: [48.4, 31.2],
    RUSSIA: [61.5, 105.3],
    TURKEY: [38.9, 35.2],
    GEORGIA: [42.3, 43.4],
    SERBIA: [44.0, 21.0],
    'UNITED STATES': [37.1, -95.7],
    USA: [37.1, -95.7],
    CANADA: [56.1, -106.3],
    MEXICO: [23.6, -102.6],
    CUBA: [21.5, -79.5],
    'COSTA RICA': [9.7, -83.8],
    PANAMA: [8.5, -80.8],
    BRAZIL: [-14.2, -51.9],
    ARGENTINA: [-38.4, -63.6],
    CHILE: [-35.7, -71.5],
    PERU: [-9.2, -75.0],
    COLOMBIA: [4.6, -74.1],
    ECUADOR: [-1.8, -78.2],
    AUSTRALIA: [-25.3, 133.8],
    'NEW ZEALAND': [-40.9, 174.9],
    UAE: [23.4, 53.8],
    'UNITED ARAB EMIRATES': [23.4, 53.8],
    QATAR: [25.4, 51.2],
    'SAUDI ARABIA': [24.0, 45.0],
    ISRAEL: [31.0, 34.9],
    JORDAN: [30.6, 36.2],
    OMAN: [21.5, 55.9],
    BAHRAIN: [26.0, 50.6],
    KUWAIT: [29.3, 47.5],
    LEBANON: [33.9, 35.5],
    IRAN: [32.4, 53.7],
    EGYPT: [26.8, 30.8],
    MOROCCO: [31.8, -7.1],
    TUNISIA: [33.9, 9.5],
    'SOUTH AFRICA': [-30.6, 22.9],
    KENYA: [-0.0, 37.9],
    TANZANIA: [-6.4, 34.9],
    ETHIOPIA: [9.1, 40.5],
    NIGERIA: [9.1, 8.7],
    MALDIVES: [4.2, 73.5],
    UZBEKISTAN: [41.4, 64.6],
    KAZAKHSTAN: [47.2, 67.0],
};

/* ─── helpers ───────────────────────────────────────────── */
const toVec3 = (lat: number, lng: number, r: number): THREE.Vector3 => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta),
    );
};

const parseCountry = (str: string) => {
    const parts = (str || '').split('/');
    return {
        emoji: parts[0] ?? '',
        nameKo: parts[1] ?? '',
        nameEn: (parts[2] ?? '').trim().toUpperCase(),
    };
};

/* ─── types ─────────────────────────────────────────────── */
interface SelectedMark {
    nameKo: string;
    nameEn: string;
    emoji: string;
    trips: TripSummary[];
    origin: { x: number; y: number };
}

const EMPTY_TRIPS: TripSummary[] = [];

/* ─── TicketCard (boarding-pass) ────────────────────────── */
const TicketCard = ({ trip, country, onPress }: { trip: TripSummary; country: SelectedMark; onPress: () => void }) => {
    const { data: imagesData } = useTripImages(trip.tripKey ?? '');
    const coverPhoto = imagesData?.success ? imagesData.data?.[0]?.mediaLink : undefined;

    return (
        <div css={ticketWrap} onClick={onPress}>
            {/* main area */}
            <div css={ticketMain}>
                <div css={ticketPhotoArea}>
                    {coverPhoto && (
                        <img
                            src={coverPhoto}
                            alt={trip.tripTitle}
                            css={ticketCoverImg}
                            onError={(e) => {
                                const img = e.currentTarget;
                                if (img.dataset.fallback === '1') return;
                                img.dataset.fallback = '1';
                                img.src = IMAGE_PLACEHOLDER;
                            }}
                        />
                    )}
                    <div css={ticketPhotoOverlay} />
                    <div css={ticketPhotoMeta}>
                        <div>
                            <div css={ticketDestLabel}>Destination</div>
                            <div css={ticketDestName}>{country.nameEn}</div>
                        </div>
                        <span css={ticketEmojiLg}>{country.emoji}</span>
                    </div>
                </div>
                <div css={ticketInfoArea}>
                    <div css={ticketInfoTitle}>{trip.tripTitle}</div>
                    <div css={ticketInfoDate}>
                        {dayjs(trip.startDate).format('YY.MM.DD')} → {dayjs(trip.endDate).format('YY.MM.DD')}
                    </div>
                </div>
            </div>

            {/* perforation */}
            <div css={ticketPerf}>
                <div css={ticketPerfNotchTop} />
                <div css={ticketPerfNotchBottom} />
            </div>

            {/* stub */}
            <div css={ticketStub}>
                <div>
                    <div css={ticketStubLabel}>Trip</div>
                    <div css={ticketStubNum}>#{String(country.trips.length).padStart(2, '0')}</div>
                </div>
                <svg width='36' height='14' viewBox='0 0 36 14' fill='none'>
                    <rect x='0' y='2' width='2' height='10' fill='#111827' />
                    <rect x='4' y='2' width='1' height='10' fill='#111827' />
                    <rect x='7' y='2' width='3' height='10' fill='#111827' />
                    <rect x='12' y='2' width='1' height='10' fill='#111827' />
                    <rect x='15' y='2' width='2' height='10' fill='#111827' />
                    <rect x='19' y='2' width='3' height='10' fill='#111827' />
                    <rect x='24' y='2' width='1' height='10' fill='#111827' />
                    <rect x='27' y='2' width='2' height='10' fill='#111827' />
                    <rect x='31' y='2' width='3' height='10' fill='#111827' />
                </svg>
            </div>
        </div>
    );
};

/* ─── main component ────────────────────────────────────── */
const GlobeMapPage = () => {
    const navigate = useNavigate();
    const showToast = useToastStore((s) => s.showToast);
    const mountRef = useRef<HTMLDivElement>(null);
    const pinsRef = useRef<THREE.Mesh[]>([]);
    const hitMeshesRef = useRef<THREE.Mesh[]>([]);
    const controlsRef = useRef<OrbitControls | null>(null);

    const [dotsReady, setDotsReady] = useState(false);
    const [selected, setSelected] = useState<SelectedMark | null>(null);
    const [ctaReady, setCtaReady] = useState(false);

    /* idle CTA timer — refs avoid stale closures inside Three.js effect */
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const armCtaRef = useRef<() => void>(() => {});
    const disarmCtaRef = useRef<() => void>(() => {});

    armCtaRef.current = () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => setCtaReady(true), 400);
    };
    disarmCtaRef.current = () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        setCtaReady(false);
    };

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

    /* 닉네임 설정 오버레이 */
    const queryClient = useQueryClient();
    const [nicknameInput, setNicknameInput] = useState('');
    const nicknameValidation = validateUserNickName(nicknameInput, NICKNAME_FORM.MIN_LENGTH, NICKNAME_FORM.MAX_LENGTH);
    const {
        isSubmitting,
        error: nicknameError,
        submitNickname,
    } = useNickname(nicknameInput, () => queryClient.invalidateQueries({ queryKey: ['summary'] }));

    const countriesMap = useMemo(() => {
        const map = new Map<string, { trips: TripSummary[]; nameKo: string; emoji: string }>();
        trips.forEach((trip) => {
            if (!trip.country) return;
            const { nameEn, nameKo, emoji } = parseCountry(trip.country);
            if (!nameEn) return;
            if (!map.has(nameEn)) map.set(nameEn, { trips: [], nameKo, emoji });
            map.get(nameEn)!.trips.push(trip);
        });
        return map;
    }, [trips]);

    const countryCount = countriesMap.size;

    /* globeState 변경 시 CTA 리셋 (자동 표시 없음 — 터치 후에만 표시) */
    useEffect(() => {
        setCtaReady(false);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    }, [globeState]);

    /* Outfit font */
    useEffect(() => {
        if (!document.getElementById('outfit-font')) {
            const link = document.createElement('link');
            link.id = 'outfit-font';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap';
            document.head.appendChild(link);
        }
    }, []);

    /* Three.js scene */
    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;
        setDotsReady(false);

        const W = container.clientWidth,
            H = container.clientHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
        camera.position.set(0, 0, 3.8);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(W, H);
        renderer.setClearColor(0x000000, 0);
        container.appendChild(renderer.domElement);

        scene.add(new THREE.Mesh(new THREE.SphereGeometry(R, 32, 32), new THREE.MeshBasicMaterial({ visible: false })));

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.09;
        controls.rotateSpeed = 0.7;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.45;
        controls.minDistance = 2.7;
        controls.maxDistance = 7.0;
        controls.enablePan = false;
        controls.enableZoom = true;
        controlsRef.current = controls;

        const visitedCentroids: Array<[number, number]> = [];
        countriesMap.forEach((_, nameEn) => {
            const c = CENTROIDS[nameEn];
            if (c) visitedCentroids.push(c);
        });

        const rings: Array<{ mesh: THREE.Mesh; t: number }> = [];

        const buildDots = (pixels: Uint8ClampedArray, CW: number, CH: number) => {
            const isLand = (lat: number, lng: number): boolean => {
                if (CW === 0) return false;
                const px = Math.min(CW - 1, Math.max(0, Math.floor(((lng + 180) / 360) * CW)));
                const py = Math.min(CH - 1, Math.max(0, Math.floor(((90 - lat) / 180) * CH)));
                const idx = (py * CW + px) * 4;
                const r = pixels[idx],
                    g = pixels[idx + 1],
                    b = pixels[idx + 2];
                return !(b > r * 1.2 && b > g * 1.1 && b > 100);
            };

            const isNearVisited = (lat: number, lng: number): boolean => {
                for (const [clat, clng] of visitedCentroids) {
                    if (Math.hypot(lat - clat, lng - clng) < VISIT_RADIUS) return true;
                }
                return false;
            };

            const grayPos: THREE.Vector3[] = [],
                bluePos: THREE.Vector3[] = [];

            for (let lat = -88; lat <= 88; lat += DOT_STEP) {
                for (let lng = -180; lng < 180; lng += DOT_STEP) {
                    if (!isLand(lat, lng)) continue;
                    const pos = toVec3(lat, lng, R);
                    (visitedCentroids.length > 0 && isNearVisited(lat, lng) ? bluePos : grayPos).push(pos);
                }
            }

            const dotGeo = new THREE.CircleGeometry(DOT_SIZE, 5);
            const dummy = new THREE.Object3D();
            const UP = new THREE.Vector3(0, 0, 1);

            const addMesh = (positions: THREE.Vector3[], color: number) => {
                if (!positions.length) return;
                const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
                const mesh = new THREE.InstancedMesh(dotGeo, mat, positions.length);
                positions.forEach((pos, i) => {
                    dummy.position.copy(pos);
                    dummy.quaternion.setFromUnitVectors(UP, pos.clone().normalize());
                    dummy.updateMatrix();
                    mesh.setMatrixAt(i, dummy.matrix);
                });
                mesh.instanceMatrix.needsUpdate = true;
                scene.add(mesh);
            };

            addMesh(grayPos, 0xc4cad6);
            addMesh(bluePos, ACCENT_HEX);

            pinsRef.current = [];
            hitMeshesRef.current = [];
            countriesMap.forEach(({ trips: ct, nameKo, emoji }, nameEn) => {
                const coords = CENTROIDS[nameEn];
                if (!coords) return;
                const pos = toVec3(coords[0], coords[1], R);
                const normal = pos.clone().normalize();

                const pin = new THREE.Mesh(
                    new THREE.SphereGeometry(0.028, 12, 12),
                    new THREE.MeshBasicMaterial({ color: ACCENT_HEX }),
                );
                pin.position.copy(pos);
                pin.userData = { nameEn, nameKo, emoji, trips: ct };
                scene.add(pin);
                pinsRef.current.push(pin);

                /* invisible hit mesh — expands click hit area ~2.7x without changing visuals */
                const hitMesh = new THREE.Mesh(
                    new THREE.SphereGeometry(0.075, 8, 8),
                    new THREE.MeshBasicMaterial({
                        transparent: true,
                        opacity: 0,
                        depthWrite: false,
                    }),
                );
                hitMesh.position.copy(pos);
                hitMesh.userData = { nameEn, nameKo, emoji, trips: ct, pin };
                scene.add(hitMesh);
                hitMeshesRef.current.push(hitMesh);

                const ring = new THREE.Mesh(
                    new THREE.RingGeometry(0.038, 0.06, 32),
                    new THREE.MeshBasicMaterial({
                        color: ACCENT_HEX,
                        transparent: true,
                        opacity: 0.6,
                        side: THREE.DoubleSide,
                        depthWrite: false,
                    }),
                );
                ring.position.copy(pos);
                ring.quaternion.setFromUnitVectors(UP, normal);
                scene.add(ring);
                rings.push({ mesh: ring, t: Math.random() });
            });

            setDotsReady(true);
        };

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const CW = 720,
                    CH = 360;
                const cvs = document.createElement('canvas');
                cvs.width = CW;
                cvs.height = CH;
                const ctx = cvs.getContext('2d')!;
                ctx.drawImage(img, 0, 0, CW, CH);
                buildDots(ctx.getImageData(0, 0, CW, CH).data, CW, CH);
            } catch {
                buildDots(new Uint8ClampedArray(0), 0, 0);
            }
        };
        img.onerror = () => buildDots(new Uint8ClampedArray(0), 0, 0);
        img.src = LAND_MASK_URL;

        /* pointer: drag detection + pin raycasting */
        const ray = new THREE.Raycaster();
        let dragged = false,
            downX = 0,
            downY = 0,
            activePointers = 0;
        const onDown = (e: PointerEvent) => {
            activePointers++;
            if (activePointers > 1) {
                dragged = true; // 멀티터치(핀치) → tap 아님
            } else {
                dragged = false;
                downX = e.clientX;
                downY = e.clientY;
            }
            disarmCtaRef.current();
            controls.autoRotate = false;
        };
        const onMove = (e: PointerEvent) => {
            if (activePointers === 1 && Math.hypot(e.clientX - downX, e.clientY - downY) > 6) dragged = true;
        };
        const onUp = (e: PointerEvent) => {
            activePointers = Math.max(0, activePointers - 1);
            if (activePointers > 0) return; // 다른 손가락이 아직 down 상태
            if (dragged) {
                armCtaRef.current();
                return;
            }
            const rect = renderer.domElement.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            ray.setFromCamera(new THREE.Vector2(x, y), camera);
            const hits = ray.intersectObjects(hitMeshesRef.current);
            if (hits.length > 0) {
                const { nameEn, nameKo, emoji, trips: t, pin } = hits[0].object.userData;
                // project pin's 3D world position to viewport pixels for ticket origin
                const proj = (pin as THREE.Mesh).position.clone().project(camera);
                const originX = ((proj.x + 1) / 2) * rect.width + rect.left;
                const originY = ((-proj.y + 1) / 2) * rect.height + rect.top;
                setSelected({ nameEn, nameKo, emoji, trips: t, origin: { x: originX, y: originY } });
                controls.autoRotate = false;
                disarmCtaRef.current();
            } else {
                setSelected(null);
                controls.autoRotate = true;
                armCtaRef.current();
            }
        };
        renderer.domElement.addEventListener('pointerdown', onDown);
        renderer.domElement.addEventListener('pointermove', onMove);
        renderer.domElement.addEventListener('pointerup', onUp);

        const onResize = () => {
            const w = container.clientWidth,
                h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', onResize);

        let rafId: number;
        const animate = () => {
            rafId = requestAnimationFrame(animate);
            rings.forEach((r) => {
                r.t = (r.t + 0.007) % 1;
                r.mesh.scale.setScalar(1 + r.t * 2.2);
                (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - r.t);
            });
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(rafId);
            renderer.domElement.removeEventListener('pointerdown', onDown);
            renderer.domElement.removeEventListener('pointermove', onMove);
            renderer.domElement.removeEventListener('pointerup', onUp);
            window.removeEventListener('resize', onResize);
            controls.dispose();
            renderer.dispose();
            controlsRef.current = null;
            if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        };
    }, [countriesMap]);

    const handleCreateFirst = async () => {
        const result = await toResult(() => tripAPI.createNewTrip());
        if (result.success) {
            navigate(ROUTES.PATH.TRIP.NEW(result.data.tripKey!));
        } else {
            showToast(result.error);
        }
    };

    const closeCard = () => {
        setSelected(null);
        if (controlsRef.current) controlsRef.current.autoRotate = true;
        armCtaRef.current();
    };

    return (
        <div css={page}>
            {/* Three.js — transparent WebGL over CSS gradient */}
            <div ref={mountRef} css={canvas} />

            {/* Editorial header */}
            {globeState !== 'loading' && (
                <div css={editorialHeader}>
                    {globeState === 'populated' && (
                        <div css={countryDisplay}>
                            <span css={countryNum}>{countryCount}</span>
                            <div css={countryLabels}>
                                <span css={countriesLabel}>COUNTRIES</span>
                                <span css={visitedLabel}>방문한 지역</span>
                            </div>
                        </div>
                    )}
                    {globeState === 'empty' && (
                        <div css={welcomeDisplay}>
                            <span css={welcomeLabel}>WELCOME</span>
                            <span css={welcomeName}>{nickname ? `${nickname}님` : '안녕하세요'}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Hint pill */}
            {dotsReady && !ctaReady && !selected && globeState !== 'loading' && (
                <div css={hintPill}>
                    <div css={hintPillInner}>
                        {globeState === 'populated' && <span css={hintDot} />}
                        <span css={hintText}>
                            {globeState === 'empty' ? '지구본을 돌려보세요' : '핀을 탭하거나 지구본을 돌려보세요'}
                        </span>
                    </div>
                </div>
            )}

            {/* Empty: CTA card */}
            {globeState === 'empty' && dotsReady && (
                <div css={emptyCard(ctaReady)}>
                    <div css={emptyCardHead}>
                        <div css={emptyIconBox}>
                            <svg
                                width='22'
                                height='22'
                                viewBox='0 0 24 24'
                                fill='none'
                                stroke={ACCENT}
                                strokeWidth='2'
                                strokeLinecap='round'
                                strokeLinejoin='round'
                            >
                                <path d='M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.2.6-.6.5-1.1z' />
                            </svg>
                        </div>
                        <div>
                            <p css={emptyCardTitle}>첫 여행을 기록해볼까요?</p>
                            <p css={emptyCardSub}>티켓 하나만 있으면 지구본이 채워져요</p>
                        </div>
                    </div>
                    <button css={emptyCtaBtn} onClick={handleCreateFirst}>
                        <svg
                            width='14'
                            height='14'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='2.5'
                            strokeLinecap='round'
                        >
                            <path d='M12 5v14M5 12h14' />
                        </svg>
                        첫 티켓 만들기
                    </button>
                </div>
            )}

            {/* Populated: bottom entry button */}
            {globeState === 'populated' && !selected && (
                <button css={ticketEntry(ctaReady)} onClick={() => navigate(ROUTES.PATH.TICKETS)}>
                    <div css={ticketEntryIcon}>
                        <svg
                            width='18'
                            height='18'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke={ACCENT}
                            strokeWidth='2.2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        >
                            <path d='M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z' />
                            <path d='M13 5v14' />
                        </svg>
                    </div>
                    <div css={ticketEntryText}>
                        <span css={ticketEntryTitle}>내 티켓 {trips.length}장</span>
                        <span css={ticketEntrySub}>리스트로 보기 · 새 티켓 추가</span>
                    </div>
                    <svg
                        width='18'
                        height='18'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='#cbd5e1'
                        strokeWidth='2'
                        strokeLinecap='round'
                    >
                        <polyline points='9 18 15 12 9 6' />
                    </svg>
                </button>
            )}

            {/* Floating ticket card — emerges from clicked pin's screen position */}
            <AnimatePresence>
                {selected && (
                    <motion.div
                        key={selected.nameEn}
                        css={floatingBackdrop}
                        onClick={closeCard}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                    >
                        <motion.div
                            onClick={(e) => e.stopPropagation()}
                            initial={{
                                x: selected.origin.x - window.innerWidth / 2,
                                y: selected.origin.y - (window.innerHeight - 96 - 96),
                                scale: 0.05,
                                opacity: 0,
                                rotate: -8,
                            }}
                            animate={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
                            exit={{ scale: 0.3, opacity: 0, transition: { duration: 0.18 } }}
                            transition={{ type: 'spring', stiffness: 220, damping: 26, mass: 0.9 }}
                            style={{ transformOrigin: 'center center' }}
                        >
                            <TicketCard
                                trip={selected.trips[0]}
                                country={selected}
                                onPress={() => navigate(ROUTES.PATH.TRIP.ROOT(selected.trips[0].tripKey!))}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Loading */}
            {!dotsReady && (
                <div css={loadingWrap}>
                    <div css={loadingOrb} />
                    <p css={loadingText}>지구본 로딩 중</p>
                </div>
            )}

            {/* Nickname setup overlay */}
            {showNicknameSetup && (
                <div css={nicknameOverlay}>
                    <div css={nicknameCard}>
                        <div css={nicknameCardEmoji}>✈️</div>
                        <h2 css={nicknameCardTitle}>트립티케에 오신 걸 환영해요!</h2>
                        <p css={nicknameCardSub}>여행 티켓에 표시될 닉네임을 정해주세요</p>

                        <div css={nicknameInputWrap(nicknameValidation.valid || !nicknameInput)}>
                            <input
                                css={nicknameInputField}
                                type='text'
                                placeholder='닉네임 입력'
                                value={nicknameInput}
                                onChange={(e) => setNicknameInput(e.target.value)}
                                maxLength={NICKNAME_FORM.MAX_LENGTH + 1}
                                autoFocus
                            />
                        </div>

                        {nicknameInput && !nicknameValidation.valid && (
                            <p css={nicknameErrorMsg}>{nicknameValidation.message}</p>
                        )}
                        {nicknameError && <p css={nicknameErrorMsg}>{nicknameError}</p>}

                        <div css={nicknameSuggestions}>
                            {NICKNAME_FORM.SUGGESTIONS.slice(0, 4).map((s) => (
                                <button key={s} css={nicknameSuggestionChip} onClick={() => setNicknameInput(s)}>
                                    {s}
                                </button>
                            ))}
                        </div>

                        <button
                            css={nicknameSubmitBtn(nicknameValidation.valid && !!nicknameInput && !isSubmitting)}
                            disabled={!nicknameValidation.valid || !nicknameInput || isSubmitting}
                            onClick={submitNickname}
                        >
                            {isSubmitting ? '처리 중...' : '닉네임 등록하기'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobeMapPage;

/* ════════════════════════════════════════════
   STYLES
════════════════════════════════════════════ */

const cardUp = keyframes`
    from { transform: translateY(24px) scale(0.94); opacity: 0; }
    to   { transform: translateY(0)    scale(1);    opacity: 1; }
`;

const fadeIn = keyframes`
    from { opacity: 0; }
    to   { opacity: 1; }
`;

const orbPulse = keyframes`
    0%, 100% { opacity: 0.5; transform: scale(1);   }
    50%       { opacity: 1;   transform: scale(1.5); }
`;

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

/* editorial header */
const editorialHeader = css`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    padding: 54px 24px 0;
    z-index: 40;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    pointer-events: none;
    animation: ${fadeIn} 0.5s ease both;
`;

const countryDisplay = css`
    display: flex;
    align-items: flex-end;
    gap: 10px;
`;

const countryNum = css`
    font-size: 44px;
    font-weight: 800;
    color: #111827;
    letter-spacing: -1.5px;
    line-height: 1;
    font-family: 'Outfit', sans-serif;
`;

const countryLabels = css`
    padding-bottom: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const countriesLabel = css`
    font-size: 11px;
    font-weight: 600;
    color: #9ca3af;
    letter-spacing: 1.5px;
    text-transform: uppercase;
`;

const visitedLabel = css`
    font-size: 12px;
    font-weight: 500;
    color: #374151;
`;

const welcomeDisplay = css`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const welcomeLabel = css`
    font-size: 11px;
    font-weight: 600;
    color: #9ca3af;
    letter-spacing: 1.5px;
    text-transform: uppercase;
`;

const welcomeName = css`
    font-size: 22px;
    font-weight: 700;
    color: #111827;
    letter-spacing: -0.5px;
`;

/* hint pill */
const hintPill = css`
    position: absolute;
    bottom: 44px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    z-index: 10;
    pointer-events: none;
    animation: ${fadeIn} 0.4s ease both;
`;

const hintPillInner = css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 100px;
    border: 1px solid rgba(0, 0, 0, 0.04);
`;

const hintDot = css`
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: ${ACCENT};
    flex-shrink: 0;
`;

const hintText = css`
    font-size: 11px;
    font-weight: 500;
    color: #6b7280;
    letter-spacing: -0.2px;
`;

/* empty CTA card */
const emptyCard = (visible: boolean) => css`
    position: absolute;
    bottom: 36px;
    left: 16px;
    right: 16px;
    z-index: 30;
    background: #fff;
    border-radius: 20px;
    padding: 18px 20px;
    box-shadow:
        0 12px 48px rgba(37, 99, 235, 0.12),
        0 4px 16px rgba(0, 0, 0, 0.04);
    border: 1px solid rgba(0, 0, 0, 0.04);
    transform: ${visible ? 'translateY(0)' : 'translateY(calc(100% + 40px))'};
    opacity: ${visible ? 1 : 0};
    transition:
        transform 600ms cubic-bezier(0.22, 1, 0.36, 1),
        opacity 400ms ease;
`;

const emptyCardHead = css`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
`;

const emptyIconBox = css`
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: ${ACCENT}18;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
`;

const emptyCardTitle = css`
    font-size: 15px;
    font-weight: 700;
    color: #111827;
    letter-spacing: -0.3px;
    margin-bottom: 3px;
`;

const emptyCardSub = css`
    font-size: 12px;
    color: #6b7280;
    line-height: 1.5;
`;

const emptyCtaBtn = css`
    width: 100%;
    padding: 13px 0;
    border-radius: 12px;
    background: ${ACCENT};
    color: #fff;
    border: none;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.2px;
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-shadow: 0 6px 20px ${ACCENT}50;
    -webkit-tap-highlight-color: transparent;
    &:active {
        opacity: 0.85;
        transform: scale(0.98);
    }
`;

/* populated bottom entry */
const ticketEntry = (visible: boolean) => css`
    position: absolute;
    bottom: 28px;
    left: 16px;
    right: 16px;
    z-index: 30;
    background: #fff;
    border-radius: 16px;
    padding: 14px 18px;
    box-shadow:
        0 8px 32px rgba(15, 23, 42, 0.12),
        0 2px 8px rgba(0, 0, 0, 0.04);
    border: 1px solid rgba(0, 0, 0, 0.04);
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transform: ${visible ? 'translateY(0)' : 'translateY(calc(100% + 40px))'};
    opacity: ${visible ? 1 : 0};
    transition:
        transform 600ms cubic-bezier(0.22, 1, 0.36, 1),
        opacity 400ms ease;
    -webkit-tap-highlight-color: transparent;
    &:active {
        opacity: 0.85;
        transform: scale(0.98);
    }
`;

const ticketEntryIcon = css`
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: ${ACCENT}15;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
`;

const ticketEntryText = css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const ticketEntryTitle = css`
    font-size: 14px;
    font-weight: 700;
    color: #111827;
    letter-spacing: -0.2px;
`;

const ticketEntrySub = css`
    font-size: 11px;
    color: #94a3b8;
`;

/* floating backdrop — opacity animated by framer-motion */
const floatingBackdrop = css`
    position: absolute;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0 20px 96px;
`;

/* ticket card — entry animation handled by framer-motion wrapper */
const ticketWrap = css`
    display: flex;
    width: 270px;
    filter: drop-shadow(0 16px 40px rgba(0, 0, 0, 0.2));
    cursor: pointer;
`;

const ticketMain = css`
    flex: 1;
    background: #fff;
    border-radius: 14px 0 0 14px;
    overflow: hidden;
`;

const ticketPhotoArea = css`
    position: relative;
    width: 100%;
    height: 120px;
    background: linear-gradient(135deg, ${ACCENT} 0%, #0284c7 100%);
`;

const ticketCoverImg = css`
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
`;

const ticketPhotoOverlay = css`
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0.5));
`;

const ticketPhotoMeta = css`
    position: absolute;
    bottom: 10px;
    left: 12px;
    right: 12px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    color: #fff;
`;

const ticketDestLabel = css`
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.5px;
    opacity: 0.85;
    text-transform: uppercase;
`;

const ticketDestName = css`
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.5px;
    line-height: 1;
`;

const ticketEmojiLg = css`
    font-size: 22px;
    line-height: 1;
`;

const ticketInfoArea = css`
    padding: 10px 14px 12px;
`;

const ticketInfoTitle = css`
    font-size: 13px;
    font-weight: 700;
    color: #111827;
    letter-spacing: -0.2px;
    margin-bottom: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const ticketInfoDate = css`
    font-size: 10px;
    color: #9ca3af;
    font-weight: 500;
    letter-spacing: 0.3px;
`;

const ticketPerf = css`
    width: 1px;
    background: repeating-linear-gradient(180deg, #d1d5db 0, #d1d5db 3px, transparent 3px, transparent 6px);
    margin: 8px 0;
    position: relative;
`;

const ticketPerfNotchTop = css`
    position: absolute;
    top: -8px;
    left: -6px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: transparent;
    box-shadow: 0 0 0 20px #fff;
    clip-path: inset(0 0 50% 0);
`;

const ticketPerfNotchBottom = css`
    position: absolute;
    bottom: -8px;
    left: -6px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: transparent;
    box-shadow: 0 0 0 20px #fff;
    clip-path: inset(50% 0 0 0);
`;

const ticketStub = css`
    width: 62px;
    background: #fff;
    border-radius: 0 14px 14px 0;
    padding: 14px 10px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
`;

const ticketStubLabel = css`
    font-size: 8px;
    color: #9ca3af;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
`;

const ticketStubNum = css`
    font-size: 18px;
    font-weight: 800;
    color: #111827;
    letter-spacing: -0.5px;
    line-height: 1;
    margin-top: 2px;
`;

/* loading */
const loadingWrap = css`
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    z-index: 10;
    pointer-events: none;
`;

const loadingOrb = css`
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${ACCENT};
    animation: ${orbPulse} 1.4s ease-in-out infinite;
`;

const loadingText = css`
    font-size: 12px;
    font-weight: 500;
    color: #9ca3af;
    letter-spacing: 0.3px;
`;

/* nickname overlay */
const nicknameOverlay = css`
    position: absolute;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    animation: ${fadeIn} 0.3s ease both;
`;

const nicknameCard = css`
    width: 100%;
    max-width: 340px;
    background: #fff;
    border-radius: 24px;
    padding: 28px 24px 24px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    align-items: center;
    animation: ${cardUp} 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
`;

const nicknameCardEmoji = css`
    font-size: 36px;
    margin-bottom: 12px;
`;

const nicknameCardTitle = css`
    font-size: 17px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.4px;
    margin-bottom: 6px;
    text-align: center;
`;

const nicknameCardSub = css`
    font-size: 13px;
    color: #64748b;
    text-align: center;
    margin-bottom: 20px;
    line-height: 1.5;
`;

const nicknameInputWrap = (valid: boolean) => css`
    width: 100%;
    border: 1.5px solid ${valid ? '#e2e8f0' : '#ef4444'};
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 8px;
    transition: border-color 0.2s;
    &:focus-within {
        border-color: ${valid ? ACCENT : '#ef4444'};
    }
`;

const nicknameInputField = css`
    width: 100%;
    padding: 12px 14px;
    font-size: 15px;
    font-weight: 500;
    border: none;
    outline: none;
    font-family: inherit;
    color: #0f172a;
    &::placeholder {
        color: #94a3b8;
    }
`;

const nicknameErrorMsg = css`
    font-size: 12px;
    color: #ef4444;
    align-self: flex-start;
    margin-bottom: 8px;
`;

const nicknameSuggestions = css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    width: 100%;
    margin-bottom: 20px;
`;

const nicknameSuggestionChip = css`
    padding: 6px 12px;
    background: #f1f5f9;
    border: none;
    border-radius: 100px;
    font-size: 12px;
    color: #475569;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    &:hover {
        background: #e2e8f0;
    }
`;

const nicknameSubmitBtn = (active: boolean) => css`
    width: 100%;
    padding: 14px;
    border-radius: 12px;
    border: none;
    font-size: 15px;
    font-weight: 700;
    font-family: inherit;
    cursor: ${active ? 'pointer' : 'not-allowed'};
    background: ${active ? ACCENT : '#cbd5e1'};
    color: #fff;
    transition:
        background 0.2s,
        transform 0.1s;
    &:active {
        transform: ${active ? 'scale(0.98)' : 'none'};
    }
`;
