/**
 * 점 지구본 씬. 렌더러·카메라·OrbitControls·렌더 루프·포인터 처리를 한곳에 두고,
 * React와는 events(최신 핸들러를 담은 ref)와 몇 개의 명령 메서드로만 주고받는다.
 * 씬은 페이지에 한 번만 만들고, 방문 나라가 바뀌면 점·핀만 다시 그린다.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { createCountryPins, CountryPins } from './countryPins';
import { COUNTRY_CENTROIDS } from './globeGeo';
import { createLandDots, LandDots, LandPoints, loadLandPoints } from './landDots';
import { getFocusCameraPosition, TicketRing } from './ticketRing/TicketRing';
import { RingTicket } from './ticketRing/ticketTexture';

export interface GlobeSceneEvents {
    /** 육지 점·핀을 처음 그렸을 때 */
    onReady: () => void;
    /** 링이 닫혀 있을 때 핀을 탭 */
    onPinTap: (nameEn: string) => void;
    /** 링 정면 티켓을 탭 */
    onTicketTap: (index: number) => void;
    /** 링 바깥을 탭했거나 링을 유지할 수 없게 됐을 때 */
    onRingDismiss: () => void;
    /** 링 회전으로 정면 티켓이 바뀜 */
    onActiveTicketChange: (index: number) => void;
    /** 지구본을 만지기 시작 / 손을 뗌(링이 닫혀 있을 때만) */
    onGlobeTouchStart: () => void;
    onGlobeTouchEnd: () => void;
}

/** 이만큼(px) 넘게 움직이면 탭이 아니라 드래그 */
const TAP_SLOP = 6;
/** 손을 멈췄다 놓으면(ms) 관성 없이 가까운 칸으로 */
const FLICK_TIMEOUT = 90;

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export class GlobeScene {
    readonly ring: TicketRing;
    private readonly scene = new THREE.Scene();
    private readonly camera: THREE.PerspectiveCamera;
    private readonly renderer: THREE.WebGLRenderer;
    private readonly controls: OrbitControls;
    private readonly raycaster = new THREE.Raycaster();
    private readonly ndc = new THREE.Vector2();
    private readonly focusTarget = new THREE.Vector3();
    private readonly pinWorld = new THREE.Vector3();
    private readonly clock = new THREE.Clock();

    private land: LandPoints | null = null;
    private dots: LandDots | null = null;
    private pins: CountryPins | null = null;
    private visitedKey: string | null = null;
    private visited: string[] = [];
    /** 링이 붙어 있는 핀. 링을 여는 중(폰트 대기)부터 닫을 때까지 */
    private focusPin: THREE.Object3D | null = null;
    private reducedMotion = false;
    private rafId = 0;
    private disposed = false;

    /* 포인터 상태 */
    private activePointers = 0;
    private dragged = false;
    private downX = 0;
    private downY = 0;
    private lastX = 0;
    private lastT = 0;
    private velocityX = 0;

    constructor(
        private readonly container: HTMLElement,
        private readonly events: { readonly current: GlobeSceneEvents },
    ) {
        const W = container.clientWidth;
        const H = container.clientHeight;

        this.camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
        this.camera.position.set(0, 0, 3.8);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(W, H);
        this.renderer.setClearColor(0x000000, 0);
        container.appendChild(this.renderer.domElement);

        const controls = new OrbitControls(this.camera, this.renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.09;
        controls.rotateSpeed = 0.7;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.45;
        controls.minDistance = 2.7;
        controls.maxDistance = 7.0;
        controls.enablePan = false;
        controls.enableZoom = true;
        this.controls = controls;

        this.ring = new TicketRing(this.scene, this.camera);
        this.ring.onActiveChange = (index) => this.events.current.onActiveTicketChange(index);

        loadLandPoints().then((land) => {
            if (this.disposed) return;
            this.land = land;
            this.rebuildMarkers();
            this.events.current.onReady();
        });

        const canvas = this.renderer.domElement;
        canvas.addEventListener('pointerdown', this.onDown);
        canvas.addEventListener('pointermove', this.onMove);
        canvas.addEventListener('pointerup', this.onUp);
        canvas.addEventListener('pointercancel', this.onCancel);
        window.addEventListener('resize', this.onResize);
        this.animate();
    }

    /** 방문 나라(영문 이름) 목록. 같은 목록이면 아무것도 하지 않는다 */
    setVisitedCountries(nameEns: string[]) {
        const key = nameEns.join('|');
        if (key === this.visitedKey) return;
        this.visitedKey = key;
        this.visited = nameEns;
        // 핀을 다시 만들면 링이 붙어 있던 핀이 사라진다 — 열린 링(캡션·히스토리 포함)을 닫게 한다
        if (this.focusPin) this.events.current.onRingDismiss();
        if (this.land) this.rebuildMarkers();
    }

    /** 핀 위에 티켓 링을 연다. 카메라가 핀으로 옮겨 가고 지구본 조작은 잠긴다 */
    openRing(nameEn: string, tickets: RingTicket[]) {
        const pin = this.pins?.pinOf(nameEn);
        if (!pin) return;
        this.focusPin = pin;
        this.reducedMotion = prefersReducedMotion();
        this.controls.autoRotate = false;
        this.controls.enabled = false;
        this.ring.open(tickets, pin, {
            reducedMotion: this.reducedMotion,
            viewportHeightPx: this.renderer.domElement.height,
        });
    }

    closeRing() {
        this.ring.close();
        this.focusPin = null;
        this.controls.enabled = true;
        this.controls.autoRotate = true;
    }

    dispose() {
        this.disposed = true;
        cancelAnimationFrame(this.rafId);
        const canvas = this.renderer.domElement;
        canvas.removeEventListener('pointerdown', this.onDown);
        canvas.removeEventListener('pointermove', this.onMove);
        canvas.removeEventListener('pointerup', this.onUp);
        canvas.removeEventListener('pointercancel', this.onCancel);
        window.removeEventListener('resize', this.onResize);
        this.ring.dispose();
        this.dots?.dispose();
        this.pins?.dispose();
        this.controls.dispose();
        this.renderer.dispose();
        // 페이지를 오갈 때마다 WebGL 컨텍스트가 쌓이지 않게 바로 반납한다
        this.renderer.forceContextLoss();
        canvas.remove();
    }

    private rebuildMarkers() {
        if (!this.land) return;
        this.dots?.dispose();
        this.pins?.dispose();
        const centroids = this.visited.map((n) => COUNTRY_CENTROIDS[n]).filter(Boolean);
        this.dots = createLandDots(this.land, centroids);
        this.scene.add(this.dots.group);
        this.pins = createCountryPins(this.scene, this.visited);
    }

    private readonly animate = () => {
        this.rafId = requestAnimationFrame(this.animate);
        const dt = Math.min(0.05, this.clock.getDelta());
        this.pins?.tick();
        if (this.ring.opened && this.focusPin) {
            // 핀이 화면 위쪽에 오도록 카메라를 옮긴다(OrbitControls는 꺼 둔 상태)
            getFocusCameraPosition(this.focusPin.getWorldPosition(this.pinWorld), this.focusTarget);
            if (this.reducedMotion) this.camera.position.copy(this.focusTarget);
            else this.camera.position.lerp(this.focusTarget, 1 - Math.exp(-dt * 3.5));
            this.camera.lookAt(0, 0, 0);
        } else {
            this.controls.update();
        }
        this.ring.frame(dt, this.clock.elapsedTime);
        this.renderer.render(this.scene, this.camera);
    };

    private readonly onResize = () => {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    };

    private castRay(e: PointerEvent) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        this.raycaster.setFromCamera(this.ndc, this.camera);
        return this.raycaster;
    }

    /** 탭한 핀(가장 가까운 것). 점 지구본은 비쳐 보이므로 뒤편 핀도 탭할 수 있다 */
    private pickPin(e: PointerEvent): string | null {
        if (!this.pins) return null;
        const hit = this.castRay(e).intersectObjects(this.pins.hitTargets, false)[0];
        return hit ? (hit.object.userData.nameEn as string) : null;
    }

    private readonly onDown = (e: PointerEvent) => {
        this.activePointers++;
        if (this.activePointers > 1) {
            this.dragged = true; // 멀티터치(핀치) → tap 아님
        } else {
            this.dragged = false;
            this.downX = this.lastX = e.clientX;
            this.downY = e.clientY;
            this.lastT = e.timeStamp;
            this.velocityX = 0;
        }
        if (this.ring.opened) {
            this.ring.beginDrag();
            return;
        }
        this.events.current.onGlobeTouchStart();
        this.controls.autoRotate = false;
    };

    private readonly onMove = (e: PointerEvent) => {
        if (this.activePointers !== 1) return;
        if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > TAP_SLOP) this.dragged = true;
        if (!this.ring.opened || !this.dragged) return;
        const dt = Math.max(8, e.timeStamp - this.lastT);
        this.velocityX = (e.clientX - this.lastX) / dt;
        this.lastX = e.clientX;
        this.lastT = e.timeStamp;
        this.ring.drag(e.clientX - this.downX);
    };

    private readonly onUp = (e: PointerEvent) => {
        this.activePointers = Math.max(0, this.activePointers - 1);
        if (this.activePointers > 0) return; // 다른 손가락이 아직 down 상태
        const { events } = this;

        if (this.ring.opened) {
            if (this.dragged) {
                this.ring.endDrag(e.timeStamp - this.lastT > FLICK_TIMEOUT ? 0 : this.velocityX);
                return;
            }
            const hit = this.ring.hitTest(this.castRay(e));
            if (hit.kind === 'front') events.current.onTicketTap(hit.index);
            else if (hit.kind === 'side') this.ring.rotateTo(hit.index);
            else events.current.onRingDismiss();
            return;
        }

        if (this.dragged) {
            events.current.onGlobeTouchEnd();
            return;
        }
        const nameEn = this.pickPin(e);
        if (nameEn) {
            events.current.onPinTap(nameEn);
        } else {
            this.controls.autoRotate = true;
            events.current.onGlobeTouchEnd();
        }
    };

    /** 시스템 제스처 등으로 포인터가 취소되면 up이 오지 않는다 — 카운트가 남으면 이후 탭이 전부 멀티터치로 취급된다 */
    private readonly onCancel = () => {
        this.activePointers = Math.max(0, this.activePointers - 1);
        if (this.activePointers > 0) return;
        if (this.ring.opened) this.ring.endDrag(0);
        else this.events.current.onGlobeTouchEnd();
    };
}
