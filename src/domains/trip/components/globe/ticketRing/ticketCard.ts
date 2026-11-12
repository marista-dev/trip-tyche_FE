import * as THREE from 'three';

import {
    createShadowCanvas,
    createTicketBackCanvas,
    drawTicketFront,
    RingTicket,
    TICKET_H,
    TICKET_W,
} from './ticketTexture';

/* ─── 커버 사진 로더 ───────────────────────────────────────
 * OCI Object Storage가 Access-Control-Allow-Origin: * 를 주므로 crossOrigin으로 받으면
 * 캔버스가 오염되지 않아 WebGL 텍스처로 올릴 수 있다. 같은 URL은 한 번만 받는다. */
const COVER_CACHE_LIMIT = 24;
const coverCache = new Map<string, Promise<HTMLImageElement | null>>();

const loadCoverImage = (url: string): Promise<HTMLImageElement | null> => {
    const cached = coverCache.get(url);
    if (cached) return cached;
    const promise = new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
    });
    coverCache.set(url, promise);
    if (coverCache.size > COVER_CACHE_LIMIT) {
        const oldest = coverCache.keys().next().value;
        if (oldest !== undefined) coverCache.delete(oldest);
    }
    return promise;
};

/* ─── 공용 텍스처(뒷면·그림자) ─────────────────────────── */
let sharedBack: THREE.CanvasTexture | null = null;
let sharedShadow: THREE.CanvasTexture | null = null;

const toTexture = (canvas: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
};

const getSharedTextures = () => {
    sharedBack ??= toTexture(createTicketBackCanvas(2));
    sharedShadow ??= toTexture(createShadowCanvas());
    return { back: sharedBack, shadow: sharedShadow };
};

export const disposeSharedTicketTextures = () => {
    sharedBack?.dispose();
    sharedShadow?.dispose();
    sharedBack = null;
    sharedShadow = null;
};

/* ─── 카드 ─────────────────────────────────────────────── */
export interface TicketCard {
    group: THREE.Group;
    /** 레이캐스트 대상(앞·뒷면) */
    faces: [THREE.Mesh, THREE.Mesh];
    setOpacity: (opacity: number, shadowStrength?: number) => void;
    setRenderOrder: (order: number) => void;
    /** 사진 수·커버가 늦게 도착하면 앞면을 다시 그린다 */
    update: (ticket: RingTicket, coverUrl?: string) => void;
    dispose: () => void;
}

/**
 * @param width 월드 단위 폭. 높이는 티켓 비율을 따른다
 * @param textureScale 캔버스 배율. 화면에 보이는 크기에 맞춰 정한다(앞면 캔버스 장당 약 1.15MB@2x, GPU에 밉맵 포함 약 1.5MB 더)
 */
export const createTicketCard = (ticket: RingTicket, width: number, textureScale: number): TicketCard => {
    const height = (width * TICKET_H) / TICKET_W;
    const shared = getSharedTextures();

    const canvas = document.createElement('canvas');
    canvas.width = TICKET_W * textureScale;
    canvas.height = TICKET_H * textureScale;
    let current = ticket;
    let cover: HTMLImageElement | null = null;
    let coverUrl: string | undefined;
    let disposed = false;
    drawTicketFront(canvas, current, cover, textureScale);
    const frontTexture = toTexture(canvas);

    const frontMat = new THREE.MeshBasicMaterial({ map: frontTexture, transparent: true, depthWrite: false });
    const backMat = new THREE.MeshBasicMaterial({ map: shared.back, transparent: true, depthWrite: false });
    const shadowMat = new THREE.MeshBasicMaterial({ map: shared.shadow, transparent: true, depthWrite: false });
    const faceGeo = new THREE.PlaneGeometry(width, height);
    const shadowGeo = new THREE.PlaneGeometry(width * 1.3, height * 1.45);

    const front = new THREE.Mesh(faceGeo, frontMat);
    const back = new THREE.Mesh(faceGeo, backMat);
    back.rotation.y = Math.PI;
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.set(0, -height * 0.1, -0.012);

    const group = new THREE.Group();
    group.add(shadow, front, back);
    group.visible = false;

    const redraw = () => {
        if (disposed) return;
        drawTicketFront(canvas, current, cover, textureScale);
        frontTexture.needsUpdate = true;
    };

    return {
        group,
        faces: [front, back],
        setOpacity(opacity, shadowStrength = 1) {
            frontMat.opacity = opacity;
            backMat.opacity = opacity;
            shadowMat.opacity = opacity * 0.42 * shadowStrength;
        },
        setRenderOrder(order) {
            shadow.renderOrder = order * 3;
            front.renderOrder = order * 3 + 1;
            back.renderOrder = order * 3 + 1;
        },
        update(next, nextCoverUrl) {
            const changed = next.photoCount !== current.photoCount || next.passenger !== current.passenger;
            current = next;
            if (changed) redraw();
            if (!nextCoverUrl || nextCoverUrl === coverUrl) return;
            coverUrl = nextCoverUrl;
            loadCoverImage(nextCoverUrl).then((img) => {
                if (!img || disposed || coverUrl !== nextCoverUrl) return;
                cover = img;
                redraw();
            });
        },
        dispose() {
            disposed = true;
            group.removeFromParent();
            faceGeo.dispose();
            shadowGeo.dispose();
            frontTexture.dispose();
            frontMat.dispose();
            backMat.dispose();
            shadowMat.dispose();
        },
    };
};
