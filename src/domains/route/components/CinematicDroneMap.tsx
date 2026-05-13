import { useEffect, useRef } from 'react';

import { useGoogleMap } from '@react-google-maps/api';

import { easeInOutCubic, easeOutQuad } from '@/domains/route/easing';
import { PinPoint } from '@/domains/route/types';
import { bearing as calcBearing, calculateDistance } from '@/domains/route/utils';
import { GOOGLE_MAPS_MAP_ID } from '@/shared/constants/map';

interface Props {
    pinPoints: PinPoint[];
    startFromIdx: number;
    isPaused: boolean;
    onFlightStart: (targetIdx: number) => void;
    onDwellStart: (idx: number) => void;
    onDwellEnd: () => void;
    onPhotoMarkerClick: (idx: number) => void;
    onComplete: () => void;
    onVectorUnavailable: () => void;
}

// 사진 원 마커 element 생성 (애니메이션 + 클릭 핸들러 포함)
function buildPhotoContent(mediaLink: string, onClick: () => void): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
        width: 92px; height: 92px;
        border-radius: 50%;
        overflow: hidden;
        background: #222;
        cursor: pointer;
        box-shadow: 0 14px 32px rgba(0, 0, 0, 0.6), 0 0 0 1.5px rgba(255, 255, 255, 0.85);
        transform: translateY(-14px) scale(0.4);
        opacity: 0;
        transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
    `;
    const img = document.createElement('img');
    img.src = mediaLink;
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none;';
    wrapper.appendChild(img);
    wrapper.onclick = (e) => { e.stopPropagation(); onClick(); };
    requestAnimationFrame(() => {
        wrapper.style.transform = 'translateY(-14px) scale(1)';
        wrapper.style.opacity = '1';
    });
    return wrapper;
}

function getSegmentDuration(distKm: number): number {
    if (distKm >= 200) return 10000;
    if (distKm >= 50) return 8000;
    return 6000;
}

// 거리별 줌은 Vector 모드의 tilt/heading 드론뷰를 위한 wide 시야였음.
// 현재 Raster fallback 환경에선 의미가 작고 long distance에서 빈 화면이 되기 쉬워 단순화.
// 매우 긴 거리(국제선급)만 줌아웃하고 나머지는 도시 단위 일정 줌.
function getSegmentZoom(distKm: number): number {
    if (distKm >= 200) return 8;
    if (distKm >= 50) return 11;
    return 14;
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

const CinematicDroneMap = ({
    pinPoints,
    startFromIdx,
    isPaused,
    onFlightStart,
    onDwellStart,
    onDwellEnd,
    onPhotoMarkerClick,
    onComplete,
    onVectorUnavailable,
}: Props) => {
    const map = useGoogleMap();

    const cancelledRef = useRef(false);
    const rafRef = useRef<number | null>(null);
    const drawnPolylineRef = useRef<google.maps.Polyline | null>(null);
    const remainingPolylineRef = useRef<google.maps.Polyline | null>(null);
    const markersRef = useRef<Array<google.maps.Marker | google.maps.marker.AdvancedMarkerElement>>([]);
    const pinContentsRef = useRef<HTMLElement[]>([]); // 핀 원본 보관 (복원용)
    const isVectorRef = useRef(false);
    const pausedRef = useRef(isPaused);
    const callbacksRef = useRef({ onFlightStart, onDwellStart, onDwellEnd, onPhotoMarkerClick, onComplete, onVectorUnavailable });

    useEffect(() => { pausedRef.current = isPaused; }, [isPaused]);
    useEffect(() => {
        callbacksRef.current = { onFlightStart, onDwellStart, onDwellEnd, onPhotoMarkerClick, onComplete, onVectorUnavailable };
    }, [onFlightStart, onDwellStart, onDwellEnd, onPhotoMarkerClick, onComplete, onVectorUnavailable]);

    useEffect(() => {
        if (!map || pinPoints.length < 2) return;
        cancelledRef.current = false;

        // Vector 감지: tilesloaded 이후 체크
        const checkAndStart = async () => {
            const rt = (map as google.maps.Map).getRenderingType?.();
            console.log('[CinematicDroneMap] renderingType =', rt);
            console.log('[CinematicDroneMap] mapId =', GOOGLE_MAPS_MAP_ID || '(unset)');
            console.log('[CinematicDroneMap] userAgent =', navigator.userAgent);
            // WebGL2 capability 진단
            try {
                const c = document.createElement('canvas');
                const gl = c.getContext('webgl2');
                console.log('[CinematicDroneMap] WebGL2 =', !!gl);
                if (gl) {
                    console.log('[CinematicDroneMap] EXT_color_buffer_float =', !!gl.getExtension('EXT_color_buffer_float'));
                    console.log('[CinematicDroneMap] GL_RENDERER =', gl.getParameter(gl.RENDERER));
                }
            } catch (e) {
                console.log('[CinematicDroneMap] WebGL2 check failed', e);
            }
            isVectorRef.current = rt === google.maps.RenderingType.VECTOR;
            if (!isVectorRef.current) {
                console.warn('[CinematicDroneMap] Vector 미지원 — tilt/heading 비활성, 카메라 추적만 유지');
            } else {
                console.log('[CinematicDroneMap] Vector 활성 — 드론 카메라 동작');
            }
            await buildOverlays();
            startTour();
        };

        const buildOverlays = async () => {
            // Drawn polyline — 파란 점선, 진행 끝점에 빛나는 head
            drawnPolylineRef.current = new google.maps.Polyline({
                path: [],
                strokeOpacity: 0,
                map,
                icons: [
                    {
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 3.5,
                            fillColor: '#0071e3',
                            fillOpacity: 1,
                            strokeColor: '#ffffff',
                            strokeWeight: 1,
                        },
                        offset: '0',
                        repeat: '18px',
                    },
                    {
                        // 진행 head — 더 큰 빛나는 점
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 7,
                            fillColor: '#ffffff',
                            fillOpacity: 1,
                            strokeColor: '#0071e3',
                            strokeWeight: 2.5,
                        },
                        offset: '100%',
                    },
                ],
            });

            // Remaining polyline — 작은 회색 점선
            remainingPolylineRef.current = new google.maps.Polyline({
                path: pinPoints.slice(startFromIdx).map((p) => ({ lat: p.latitude, lng: p.longitude })),
                strokeOpacity: 0,
                map,
                icons: [
                    {
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 2,
                            fillColor: '#95a5a6',
                            fillOpacity: 0.6,
                            strokeOpacity: 0,
                        },
                        offset: '0',
                        repeat: '14px',
                    },
                ],
            });

            // PinPoint markers — AdvancedMarkerElement + PinElement
            // 도착 시 사진 원으로 변신 (handleArrival에서 content 교체)
            // 단, mapId 없으면 AdvancedMarkerElement가 동작 안 함 → 기본 Marker로 폴백
            if (!GOOGLE_MAPS_MAP_ID) {
                console.warn('[CinematicDroneMap] GOOGLE_MAPS_MAP_ID 미설정 — 기본 Marker로 폴백');
                pinPoints.forEach((p) => {
                    const marker = new google.maps.Marker({
                        position: { lat: p.latitude, lng: p.longitude },
                        map,
                    });
                    markersRef.current.push(marker);
                });
                return;
            }
            try {
                const { AdvancedMarkerElement, PinElement } =
                    (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary;
                if (cancelledRef.current) return;
                pinPoints.forEach((p) => {
                    const pin = new PinElement({
                        scale: 1.3,
                        background: '#0071e3',
                        borderColor: '#0055d4',
                        glyphColor: '#ffffff',
                    });
                    // PinElement 자체가 HTMLElement — `.element` 접근은 deprecated
                    const pinEl = pin as unknown as HTMLElement;
                    pinContentsRef.current.push(pinEl);
                    const marker = new AdvancedMarkerElement({
                        map,
                        position: { lat: p.latitude, lng: p.longitude },
                        content: pinEl,
                    });
                    markersRef.current.push(marker);
                });
            } catch (e) {
                console.warn('[CinematicDroneMap] AdvancedMarkerElement load failed, fallback to default marker', e);
                pinPoints.forEach((p) => {
                    const marker = new google.maps.Marker({
                        position: { lat: p.latitude, lng: p.longitude },
                        map,
                    });
                    markersRef.current.push(marker);
                });
            }
        };

        const sleep = (ms: number): Promise<void> =>
            new Promise((resolve) => {
                if (cancelledRef.current) { resolve(); return; }
                setTimeout(resolve, ms);
            });

        const slowRotate = (durationMs: number, sweepDegrees: number): Promise<void> => {
            return new Promise((resolve) => {
                if (!isVectorRef.current) {
                    setTimeout(resolve, durationMs);
                    return;
                }
                const startHeading = map.getHeading() ?? 0;
                const startTime = performance.now();
                const tick = (now: number) => {
                    if (cancelledRef.current) { resolve(); return; }
                    const t = Math.min((now - startTime) / durationMs, 1);
                    const eased = easeInOutCubic(t);
                    map.moveCamera({
                        heading: startHeading + sweepDegrees * eased,
                        tilt: 45,
                    });
                    if (t < 1) rafRef.current = requestAnimationFrame(tick);
                    else resolve();
                };
                rafRef.current = requestAnimationFrame(tick);
            });
        };

        const zoomIn = (durationMs: number, zoomDelta = 3, sweepDegrees = 0): Promise<void> => {
            return new Promise((resolve) => {
                const startZoom = map.getZoom() ?? 16;
                const targetZoom = Math.min(startZoom + zoomDelta, 19);
                const startHeading = map.getHeading() ?? 0;
                const startTime = performance.now();
                const tick = (now: number) => {
                    if (cancelledRef.current) { resolve(); return; }
                    const t = Math.min((now - startTime) / durationMs, 1);
                    // easeOutQuad: 도착 즉시 빠르게 시작, 끝에서 부드럽게 정착 — 정지감 제거
                    const eased = easeOutQuad(t);
                    const z = lerp(startZoom, targetZoom, eased);
                    if (isVectorRef.current) {
                        map.moveCamera({
                            zoom: z,
                            tilt: 45,
                            heading: startHeading + sweepDegrees * eased,
                        });
                    } else {
                        map.setZoom(z);
                    }
                    if (t < 1) rafRef.current = requestAnimationFrame(tick);
                    else resolve();
                };
                rafRef.current = requestAnimationFrame(tick);
            });
        };

        const zoomOutAndAlign = (currentIdx: number, durationMs: number): Promise<void> => {
            return new Promise((resolve) => {
                const cur = pinPoints[currentIdx];
                const next = pinPoints[currentIdx + 1];
                const distKm = calculateDistance(cur.latitude, cur.longitude, next.latitude, next.longitude);
                const targetZoom = getSegmentZoom(distKm);
                const targetHeading = calcBearing(cur, next);
                const startZoom = map.getZoom() ?? 18;
                const startHeading = map.getHeading() ?? 0;
                // 최단 각도 회전
                let delta = targetHeading - startHeading;
                if (delta > 180) delta -= 360;
                if (delta < -180) delta += 360;
                const startTime = performance.now();
                const tick = (now: number) => {
                    if (cancelledRef.current) { resolve(); return; }
                    const t = Math.min((now - startTime) / durationMs, 1);
                    const eased = easeInOutCubic(t);
                    const z = lerp(startZoom, targetZoom, eased);
                    if (isVectorRef.current) {
                        map.moveCamera({
                            zoom: z,
                            tilt: 45,
                            heading: startHeading + delta * eased,
                        });
                    } else {
                        map.setZoom(z);
                    }
                    if (t < 1) rafRef.current = requestAnimationFrame(tick);
                    else resolve();
                };
                rafRef.current = requestAnimationFrame(tick);
            });
        };

        const flyToNext = (segIdx: number) => {
            if (cancelledRef.current) return;

            if (segIdx >= pinPoints.length - 1) {
                // 전체 경로 fitBounds
                const bounds = new google.maps.LatLngBounds();
                pinPoints.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }));
                map.fitBounds(bounds, 80);
                callbacksRef.current.onComplete();
                return;
            }

            const start = pinPoints[segIdx];
            const end = pinPoints[segIdx + 1];
            const distKm = calculateDistance(start.latitude, start.longitude, end.latitude, end.longitude);
            const duration = getSegmentDuration(distKm);
            const zoom = getSegmentZoom(distKm);
            const targetHeading = calcBearing(start, end);

            // 카운터를 즉시 다음 PinPoint로 업데이트
            callbacksRef.current.onFlightStart(segIdx + 1);

            let startTime: number | null = null;

            const animate = (now: number) => {
                if (cancelledRef.current) return;
                if (!startTime) startTime = now;

                const rawT = Math.min((now - startTime) / duration, 1);
                const t = easeInOutCubic(rawT);

                const curLat = lerp(start.latitude, end.latitude, t);
                const curLng = lerp(start.longitude, end.longitude, t);

                // 비행 내내 점진적으로 줌 +3 — 대부분 wide view 유지, 마지막 25%에서 급격히 close-up
                // rawT^5 곡선: rawT=0.5→+0.09, rawT=0.7→+0.5, rawT=0.85→+1.3, rawT=0.95→+2.3, rawT=1.0→+3
                const zoomCurve = Math.pow(rawT, 5);
                const curZoom = lerp(zoom, Math.min(zoom + 3, 19), zoomCurve);

                if (isVectorRef.current) {
                    map.moveCamera({
                        center: { lat: curLat, lng: curLng },
                        tilt: 45,
                        heading: targetHeading,
                        zoom: curZoom,
                    });
                } else {
                    map.panTo({ lat: curLat, lng: curLng });
                    if (Math.abs((map.getZoom() ?? 0) - curZoom) > 0.05) map.setZoom(curZoom);
                }

                // 점선 트레일 업데이트
                const drawnPath = [
                    ...pinPoints.slice(0, segIdx + 1).map((p) => ({ lat: p.latitude, lng: p.longitude })),
                    { lat: curLat, lng: curLng },
                ];
                drawnPolylineRef.current?.setPath(drawnPath);
                remainingPolylineRef.current?.setPath(
                    pinPoints.slice(segIdx + 1).map((p) => ({ lat: p.latitude, lng: p.longitude })),
                );

                if (rawT < 1) {
                    rafRef.current = requestAnimationFrame(animate);
                } else {
                    handleArrival(segIdx + 1, true);
                }
            };

            rafRef.current = requestAnimationFrame(animate);
        };

        const swapToPhoto = (idx: number) => {
            const marker = markersRef.current[idx];
            if (!marker || !('content' in marker)) return;
            const pinPoint = pinPoints[idx];
            const photoEl = buildPhotoContent(pinPoint.mediaLink, () =>
                callbacksRef.current.onPhotoMarkerClick(idx),
            );
            (marker as google.maps.marker.AdvancedMarkerElement).content = photoEl;
        };

        const swapBackToPin = (idx: number) => {
            const marker = markersRef.current[idx];
            const pinEl = pinContentsRef.current[idx];
            if (!marker || !('content' in marker) || !pinEl) return;
            (marker as google.maps.marker.AdvancedMarkerElement).content = pinEl;
        };

        const waitWhilePaused = async () => {
            while (pausedRef.current && !cancelledRef.current) {
                await sleep(120);
            }
        };

        const handleArrival = async (arrivedIdx: number, fromFlight = false) => {
            if (cancelledRef.current) return;

            // 1. 줌인 — 비행으로 도착하면 이미 +3 줌 상태(짧은 settle만), 초기 진입이면 zoomIn 실행
            if (fromFlight) {
                await sleep(300);
            } else {
                await zoomIn(1800, 3, 0);
            }
            if (cancelledRef.current) return;

            // 2. 줌이 땡겨졌으니 하단 바 노출
            callbacksRef.current.onDwellStart(arrivedIdx);

            // 3. 핀 → 사진 원
            swapToPhoto(arrivedIdx);
            await sleep(400);
            if (cancelledRef.current) return;

            // 4. 천천히 120° 회전 (4.5초)
            await slowRotate(4500, 120);
            if (cancelledRef.current) return;

            // 5. 일시정지 상태면 사용자가 재개할 때까지 대기
            await waitWhilePaused();
            if (cancelledRef.current) return;

            // 6. 짧은 hold
            await sleep(500);
            if (cancelledRef.current) return;

            // 7. 마지막 PinPoint면 종료 (바는 visible 유지 — restart 버튼 표시 위해)
            if (arrivedIdx >= pinPoints.length - 1) {
                callbacksRef.current.onComplete();
                return;
            }

            // 8. 다음 구간으로 — 바 숨김
            callbacksRef.current.onDwellEnd();
            swapBackToPin(arrivedIdx);
            await sleep(250);
            if (cancelledRef.current) return;
            await zoomOutAndAlign(arrivedIdx, 1800);
            if (cancelledRef.current) return;

            flyToNext(arrivedIdx);
        };

        const startTour = async () => {
            const first = pinPoints[startFromIdx];
            // 인트로: 첫 PinPoint 위에 넓은 시야로 시작 (zoom 13)
            if (isVectorRef.current) {
                map.moveCamera({
                    center: { lat: first.latitude, lng: first.longitude },
                    zoom: 13,
                    tilt: 45,
                    heading: 0,
                });
            } else {
                map.panTo({ lat: first.latitude, lng: first.longitude });
                map.setZoom(13);
            }
            await sleep(1200);
            if (cancelledRef.current) return;

            // 첫 PinPoint도 도착 시퀀스를 거침 (생략되지 않음)
            handleArrival(startFromIdx);
        };

        // 렌더링 타입 확정 후 시작 — VECTOR/RASTER 둘 다 확정 상태
        const rt = (map as google.maps.Map).getRenderingType?.();
        const isDetermined = rt === google.maps.RenderingType.VECTOR || rt === google.maps.RenderingType.RASTER;
        const listeners: google.maps.MapsEventListener[] = [];
        if (isDetermined) {
            setTimeout(() => { if (!cancelledRef.current) checkAndStart(); }, 50);
        } else {
            // UNINITIALIZED — 확정될 때까지 대기. 가장 빨리 발생하는 이벤트로 시작.
            const oneShot = () => {
                listeners.forEach((l) => google.maps.event.removeListener(l));
                listeners.length = 0;
                checkAndStart();
            };
            listeners.push(google.maps.event.addListenerOnce(map, 'renderingtype_changed', oneShot));
            listeners.push(google.maps.event.addListenerOnce(map, 'tilesloaded', oneShot));
        }

        return () => {
            cancelledRef.current = true;
            listeners.forEach((l) => google.maps.event.removeListener(l));
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            drawnPolylineRef.current?.setMap(null);
            remainingPolylineRef.current?.setMap(null);
            markersRef.current.forEach((m) => {
                if ('setMap' in m) m.setMap(null);
                else m.map = null;
            });
            markersRef.current = [];
            pinContentsRef.current = [];
        };
    }, [map, pinPoints, startFromIdx]);

    return null;
};

export default CinematicDroneMap;
