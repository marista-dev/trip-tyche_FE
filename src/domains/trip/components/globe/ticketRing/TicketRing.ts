import * as THREE from 'three';

import { markRingBuilt } from './coverTiming';
import { activeIndexOf, getRingLayout, nearestTurnTo, RingLayout, snapTurn } from './ringLayout';
import { Spring } from './spring';
import { createTicketCard, disposeSharedTicketTextures, TicketCard } from './ticketCard';
import { MAX_TEXTURE_SCALE, RingTicket, TICKET_W, waitForTicketFonts } from './ticketTexture';

/** 링 중심을 카메라에서 얼마나 앞에 둘지(정면 카드까지 거리 = 이 값) */
const FRONT_DISTANCE = 2.05;
/** 드래그 1px당 회전(rad) */
const RAD_PER_PX = 0.0085;
/** 핀이 화면 중앙보다 이만큼(rad) 위에 보이도록 카메라를 내린다 */
export const FOCUS_ELEVATION = 0.78;
export const FOCUS_DISTANCE = 3.55;

interface RingCard {
    card: TicketCard;
    progress: Spring;
    delay: number;
}

export type RingTapResult = { kind: 'front'; index: number } | { kind: 'side'; index: number } | { kind: 'none' };

export interface RingOpenOptions {
    reducedMotion?: boolean;
    /** 렌더 버퍼 높이(기기 픽셀). 텍스처 해상도를 정하는 데 쓴다 */
    viewportHeightPx?: number;
}

/**
 * 정면 카드가 화면에서 차지하는 기기 픽셀 폭에 맞춘 캔버스 배율(0.25 단위 올림).
 * 이보다 크게 그리면 화면엔 차이가 없고 카드마다 캔버스·GPU 메모리만 늘어난다.
 */
const textureScaleFor = (cardWidth: number, fovDeg: number, viewportHeightPx: number) => {
    const visibleHeight = 2 * FRONT_DISTANCE * Math.tan((fovDeg * Math.PI) / 360);
    const cardPx = (cardWidth / visibleHeight) * viewportHeightPx;
    return Math.min(MAX_TEXTURE_SCALE, Math.max(1, Math.ceil((cardPx / TICKET_W) * 4) / 4));
};

/* frame()에서 매 프레임 재사용하는 임시 벡터 */
const _pinWorld = new THREE.Vector3();
const _pinLocal = new THREE.Vector3();
const _slot = new THREE.Vector3();
const _beamTop = new THREE.Vector3();

/**
 * 핀 아래에서 티켓이 회전목마처럼 도는 링(Concept E1).
 * 링은 카메라의 자식으로 붙어 화면에 고정되고, 카드는 핀에서 튀어나와 제자리로 간다.
 * React 밖에서 매 프레임 갱신하고, 정면 카드가 바뀔 때만 onActiveChange로 알린다.
 */
export class TicketRing {
    private readonly ring = new THREE.Group();
    private readonly beam: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    private readonly rotation = new Spring(0, 90, 16);
    private cards: RingCard[] = [];
    private layout: RingLayout = getRingLayout(0);
    private pin: THREE.Object3D | null = null;
    private isOpen = false;
    private dragStart = 0;
    private activeIndex = -1;
    private reducedMotion = false;
    /** open() 호출마다 증가 — 폰트를 기다리는 사이 닫히거나 다시 열리면 늦게 온 open을 버린다 */
    private openToken = 0;
    /** 가장 최근 티켓·커버. 폰트를 기다리는 동안 도착한 사진 수·커버도 카드를 만들 때 반영한다 */
    private tickets: RingTicket[] = [];
    private coverUrls: (string | undefined)[] = [];

    /** 링 회전으로 정면 카드가 바뀌면 호출 */
    onActiveChange: (index: number) => void = () => {};

    constructor(
        scene: THREE.Scene,
        private readonly camera: THREE.PerspectiveCamera,
    ) {
        // 링을 카메라 공간에 둔다 — 카메라가 핀을 향해 움직여도 화면 아래 같은 자리에 머문다
        if (!camera.parent) scene.add(camera);
        camera.add(this.ring);
        this.ring.rotation.x = 0.1;
        this.beam = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
            new THREE.LineBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0 }),
        );
        this.beam.frustumCulled = false;
        scene.add(this.beam);
    }

    get opened() {
        return this.isOpen;
    }

    /** 캔버스 텍스처에 쓰는 웹폰트가 준비된 뒤 카드를 만든다(캐시돼 있으면 다음 마이크로태스크) */
    open(tickets: RingTicket[], pin: THREE.Object3D, options: RingOpenOptions = {}) {
        const token = ++this.openToken;
        this.tickets = tickets;
        this.coverUrls = [];
        waitForTicketFonts().then(() => {
            if (token === this.openToken) this.build(pin, options);
        });
    }

    private build(pin: THREE.Object3D, { reducedMotion = false, viewportHeightPx = 0 }: RingOpenOptions) {
        const { tickets } = this;
        this.clearCards();
        this.pin = pin;
        this.isOpen = true;
        this.reducedMotion = reducedMotion;
        this.activeIndex = -1;
        this.layout = getRingLayout(tickets.length);
        this.ring.position.set(0, -0.1, -(FRONT_DISTANCE + this.layout.radius));

        const textureScale = viewportHeightPx
            ? textureScaleFor(this.layout.cardWidth, this.camera.fov, viewportHeightPx)
            : MAX_TEXTURE_SCALE;
        this.cards = tickets.map((ticket, i) => {
            const card = createTicketCard(ticket, this.layout.cardWidth, textureScale);
            card.update(ticket, this.coverUrls[i]);
            this.ring.add(card.group);
            const progress = new Spring(0, 120, 14);
            progress.set(1);
            if (reducedMotion) progress.snap(1);
            return { card, progress, delay: reducedMotion ? 0 : 0.2 + i * 0.06 };
        });

        markRingBuilt();

        // 반 바퀴 돌며 펼쳐진다
        this.rotation.snap(tickets.length > 1 && !reducedMotion ? -Math.PI * 0.8 : 0);
        this.rotation.set(0);
    }

    close() {
        this.openToken++;
        if (!this.isOpen) return;
        this.isOpen = false;
        this.cards.forEach((c) => {
            c.delay = 0;
            c.progress.set(0);
            if (this.reducedMotion) c.progress.snap(0);
        });
    }

    /** 사진 수·커버가 나중에 도착했을 때 */
    updateTickets(tickets: RingTicket[], coverUrls: (string | undefined)[]) {
        this.tickets = tickets;
        this.coverUrls = coverUrls;
        this.cards.forEach((c, i) => tickets[i] && c.card.update(tickets[i], coverUrls[i]));
    }

    beginDrag() {
        this.dragStart = this.rotation.x;
    }

    drag(dxPx: number) {
        if (this.cards.length < 2) return;
        this.rotation.snap(this.dragStart - dxPx * RAD_PER_PX);
    }

    endDrag(velocityPxPerMs: number) {
        if (this.cards.length < 2) return;
        this.rotation.set(snapTurn(this.rotation.x, velocityPxPerMs * RAD_PER_PX, this.layout.step) * this.layout.step);
    }

    rotateTo(index: number) {
        const { step } = this.layout;
        const turn = nearestTurnTo(Math.round(this.rotation.target / step), index, this.cards.length);
        this.rotation.set(turn * step);
    }

    hitTest(raycaster: THREE.Raycaster): RingTapResult {
        const faces = this.cards.filter((c) => c.card.group.visible).flatMap((c) => c.card.faces);
        const hit = raycaster.intersectObjects(faces, false)[0];
        if (!hit) return { kind: 'none' };
        const index = this.cards.findIndex((c) => c.card.faces.includes(hit.object as THREE.Mesh));
        if (index < 0) return { kind: 'none' };
        return { kind: index === this.activeIndex ? 'front' : 'side', index };
    }

    frame(dt: number, time: number) {
        if (!this.cards.length) return;
        this.rotation.step(dt);
        this.ring.updateMatrixWorld();

        const pinWorld = this.pin ? this.pin.getWorldPosition(_pinWorld) : _pinWorld.set(0, 0, 0);
        const pinLocal = this.ring.worldToLocal(_pinLocal.copy(pinWorld));
        const { radius, step } = this.layout;
        let shown = 0;
        let settledClosed = true;

        this.cards.forEach((c, i) => {
            if (c.delay > 0) c.delay -= dt;
            else c.progress.step(dt);
            const t = Math.max(0, c.progress.x);
            if (t > 0.01 || c.progress.target > 0) settledClosed = false;
            shown += Math.min(1, t);

            const { group } = c.card;
            group.visible = t > 0.01;
            if (!group.visible) return;

            const angle = i * step - this.rotation.x;
            const bob = this.reducedMotion ? 0 : Math.sin(time * 1.6 + i) * 0.012;
            const slot = _slot.set(Math.sin(angle) * radius, bob, Math.cos(angle) * radius);
            group.position.copy(pinLocal).lerp(slot, Math.min(t, 1.12));
            group.rotation.set(0, angle * Math.min(1, t), 0);
            group.scale.setScalar(0.05 + 0.95 * t);

            // 뒤로 갈수록 흐리게, 정면이 가장 위에 그려지게
            const depth = (Math.cos(angle) + 1) / 2;
            c.card.setOpacity((0.28 + 0.72 * depth ** 1.6) * Math.min(1, t * 1.4), depth);
            c.card.setRenderOrder(Math.round(depth * 50));
        });

        const active = activeIndexOf(this.rotation.x, step, this.cards.length);
        if (this.isOpen && active !== this.activeIndex) {
            this.activeIndex = active;
            this.onActiveChange(active);
        }

        // 핀과 정면 카드 윗변을 잇는 빛줄기
        const top = this.ring.localToWorld(_beamTop.set(0, 0.2, radius));
        const pos = this.beam.geometry.attributes.position as THREE.BufferAttribute;
        pos.setXYZ(0, pinWorld.x, pinWorld.y, pinWorld.z);
        pos.setXYZ(1, top.x, top.y, top.z);
        pos.needsUpdate = true;
        this.beam.material.opacity = 0.45 * (shown / this.cards.length);

        // 닫힘 애니메이션이 끝나면 GPU 자원을 바로 돌려준다
        if (!this.isOpen && settledClosed) this.clearCards();
    }

    dispose() {
        this.openToken++;
        this.clearCards();
        this.ring.removeFromParent();
        this.beam.removeFromParent();
        this.beam.geometry.dispose();
        this.beam.material.dispose();
        disposeSharedTicketTextures();
    }

    private clearCards() {
        this.cards.forEach((c) => c.card.dispose());
        this.cards = [];
        this.beam.material.opacity = 0;
    }
}

/**
 * 핀을 FOCUS_ELEVATION만큼 화면 위쪽에 두는 카메라 위치.
 * 핀 방향에서 남쪽(화면 아래)으로 고개를 내린 방향에 카메라를 둔다.
 */
const _n = new THREE.Vector3();
const _south = new THREE.Vector3();
export const getFocusCameraPosition = (pinWorld: THREE.Vector3, out = new THREE.Vector3()) => {
    const n = _n.copy(pinWorld).normalize();
    // 위쪽(0,1,0)에서 핀 방향 성분을 뺀 접선(북쪽). 아래에서 -sin을 곱해 카메라를 남쪽으로 내린다
    const south = _south.set(0, 1, 0).addScaledVector(n, -n.y);
    if (south.lengthSq() < 1e-6) south.set(0, 0, 1);
    south.normalize();
    return out
        .copy(n)
        .multiplyScalar(Math.cos(FOCUS_ELEVATION))
        .addScaledVector(south, -Math.sin(FOCUS_ELEVATION))
        .normalize()
        .multiplyScalar(FOCUS_DISTANCE);
};
