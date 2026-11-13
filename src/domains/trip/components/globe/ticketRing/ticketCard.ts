import * as THREE from 'three';

import { currentCoverTimingId, markCoverDrawn } from './coverTiming';
import {
    CoverImage,
    createShadowCanvas,
    createTicketBackCanvas,
    drawTicketFront,
    MAX_TEXTURE_SCALE,
    RingTicket,
    TICKET_H,
    TICKET_W,
} from './ticketTexture';
import { perfNow } from '@/libs/perf';

/* ─── 커버 사진 로더 ───────────────────────────────────────
 * OCI Object Storage가 Access-Control-Allow-Origin: * 를 주므로 CORS로 받으면
 * 캔버스가 오염되지 않아 WebGL 텍스처로 올릴 수 있다. 같은 URL은 한 번만 받는다.
 *
 * 사진은 이미지 워커가 긴 변 1920px로 저장하지만 앞면에는 최대 TICKET_W × MAX_TEXTURE_SCALE(750px) 폭으로만 그린다.
 * <img>를 canvas에 그리면 원본 크기 디코딩이 메인 스레드에서 동기로 일어난다(로컬 측정: 1200px 사진 91ms, CPU 4x).
 * createImageBitmap(blob, { resizeWidth })는 메인 스레드 밖에서 디코딩하면서 줄이므로 끊김과 메모리를 함께 줄인다. */
const COVER_DECODE_WIDTH = TICKET_W * MAX_TEXTURE_SCALE;
/** 줄인 비트맵 장당 약 1.7MB(750×560×4). 링 한 번에 쓰는 카드 수보다 넉넉하게 둔다 */
const COVER_CACHE_LIMIT = 12;
/** 응답이 멈춘 요청이 커버를 영영 막지 않게 한다. 넘기면 <img> 경로로 다시 시도한다 */
const COVER_FETCH_TIMEOUT_MS = 10_000;

export interface LoadedCover {
    image: CoverImage;
    /** 받은 파일 크기. <img> 대체 경로에서는 알 수 없다 */
    bytes: number | null;
}

const coverCache = new Map<string, Promise<LoadedCover | null>>();

const loadWithImageElement = (url: string) =>
    new Promise<LoadedCover | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.onload = () => resolve({ image: img, bytes: null });
        img.onerror = () => resolve(null);
        img.src = url;
    });

const loadAsBitmap = async (url: string): Promise<LoadedCover> => {
    const signal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(COVER_FETCH_TIMEOUT_MS) : undefined;
    const response = await fetch(url, { mode: 'cors', credentials: 'omit', signal });
    if (!response.ok) throw new Error(`cover ${response.status}`);
    const blob = await response.blob();
    const image = await createImageBitmap(blob, { resizeWidth: COVER_DECODE_WIDTH, resizeQuality: 'high' });
    return { image, bytes: blob.size };
};

const loadCover = (url: string): Promise<LoadedCover | null> => {
    const cached = coverCache.get(url);
    if (cached) return cached;
    // createImageBitmap 옵션을 못 쓰거나 fetch가 막히면(CORS 등) 예전 <img> 경로로 받는다
    const promise =
        typeof createImageBitmap === 'function'
            ? loadAsBitmap(url).catch(() => loadWithImageElement(url))
            : loadWithImageElement(url);
    coverCache.set(url, promise);
    // 끝내 못 받았으면 캐시에서 지워 다음에 링을 열 때 다시 시도한다
    promise.then((loaded) => {
        if (!loaded && coverCache.get(url) === promise) coverCache.delete(url);
    });
    if (coverCache.size > COVER_CACHE_LIMIT) {
        // 비트맵은 close()하지 않는다. 아직 이 사진을 쓰는 카드가 다시 그릴 수 있고, 참조가 끊기면 GC가 회수한다
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

/** 카드 면 재질. 앞·뒤·그림자가 모두 같은 설정이라 셰이더 프로그램 하나를 공유한다 */
const faceMaterial = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });

/**
 * 카드 재질 셰이더를 미리 컴파일하기 위한 작은 씬.
 * 링을 처음 열 때 이 셰이더를 컴파일하느라 한 프레임이 멈췄다(로컬 측정 110ms, CPU 4x, 대부분 getProgramInfoLog).
 * 지구본이 한가할 때 renderer.compileAsync로 이 씬을 컴파일해 두면 링 카드가 같은 프로그램을 재사용한다.
 * 재질을 dispose하면 three가 프로그램도 지우므로, 지구본이 살아 있는 동안 들고 있다가 함께 정리한다.
 */
export const createTicketShaderWarmup = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const texture = toTexture(canvas);
    const material = faceMaterial(texture);
    const geometry = new THREE.PlaneGeometry(1, 1);
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    return {
        scene,
        dispose: () => {
            geometry.dispose();
            material.dispose();
            texture.dispose();
        },
    };
};

export const disposeSharedTicketTextures = () => {
    sharedBack?.dispose();
    sharedShadow?.dispose();
    sharedBack = null;
    sharedShadow = null;
};

const noop = () => {};

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
    let cover: CoverImage | null = null;
    let coverUrl: string | undefined;
    let disposed = false;
    /** 이 카드가 속한 측정 세션. 이전 링 카드의 늦은 사진이 새 링 측정에 섞이지 않게 만들 때 고정한다 */
    const timingId = currentCoverTimingId();
    /** 커버 URL이 바뀌어 다시 그려도 렌더 완료는 카드당 한 번만 센다 */
    let coverTimed = false;
    drawTicketFront(canvas, current, cover, textureScale);
    const frontTexture = toTexture(canvas);

    const frontMat = faceMaterial(frontTexture);
    const backMat = faceMaterial(shared.back);
    const shadowMat = faceMaterial(shared.shadow);
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
            loadCover(nextCoverUrl).then((loaded) => {
                if (!loaded || disposed || coverUrl !== nextCoverUrl) return;
                cover = loaded.image;
                const drawStart = perfNow();
                redraw();
                const onRendered = coverTimed
                    ? null
                    : markCoverDrawn(timingId, nextCoverUrl, loaded, perfNow() - drawStart);
                if (onRendered) {
                    coverTimed = true;
                    // 텍스처는 이 면이 실제로 그려질 때 GPU로 올라간다(입장 지연 동안은 보이지 않아 그려지지 않는다)
                    front.onAfterRender = () => {
                        front.onAfterRender = noop;
                        onRendered();
                    };
                }
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
