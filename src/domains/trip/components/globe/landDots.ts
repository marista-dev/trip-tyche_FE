/**
 * 지구본 육지 점. 육지 마스크를 한 번만 읽어 점 위치·행렬을 모듈에 캐시하고,
 * 방문 나라가 바뀌면 회색/파란 점 메시만 다시 나눈다(재진입·목록 갱신 때 마스크·행렬 계산을 건너뛴다).
 */
import * as THREE from 'three';

import { GLOBE_RADIUS, toVec3 } from './globeGeo';

/**
 * 720×360 1bit 육지 마스크(흰색=육지, 4.3KB).
 * 예전 public/earth-texture.jpg(1600×800, 245KB, git 기록에 있음)를 720×360으로 줄여 파란 바다를 가려낸
 * 결과를 그대로 굳혔다 — Chrome에서 같은 판정과 픽셀 단위로 일치함을 확인했다.
 */
const LAND_MASK_URL = '/land-mask.png';
const MASK_W = 720;
const MASK_H = 360;
const DOT_STEP = 1.1;
const DOT_SIZE = 0.005;
/** 방문 나라 중심에서 이 거리(위경도 도) 안의 점을 파랗게 칠한다 */
const VISIT_RADIUS = 5;
const GRAY = 0xc4cad6;
const ACCENT_HEX = 0x0ea5e9; // COLORS.ACCENT('#0ea5e9')의 숫자 표현

export interface LandPoints {
    count: number;
    /** [위도, 경도] × count */
    latLng: Float64Array;
    /** 점마다 구면에 눕힌 4×4 행렬 × count */
    matrices: Float32Array;
}

const EMPTY_LAND: LandPoints = { count: 0, latLng: new Float64Array(0), matrices: new Float32Array(0) };

const readMask = () =>
    new Promise<Uint8ClampedArray>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = MASK_W;
            canvas.height = MASK_H;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return reject(new Error('2d context unavailable'));
            ctx.drawImage(img, 0, 0, MASK_W, MASK_H);
            resolve(ctx.getImageData(0, 0, MASK_W, MASK_H).data);
        };
        img.onerror = reject;
        img.src = LAND_MASK_URL;
    });

const sampleLand = (pixels: Uint8ClampedArray): LandPoints => {
    const isLand = (lat: number, lng: number) => {
        const px = Math.min(MASK_W - 1, Math.max(0, Math.floor(((lng + 180) / 360) * MASK_W)));
        const py = Math.min(MASK_H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * MASK_H)));
        return pixels[(py * MASK_W + px) * 4] > 127;
    };

    const latLng: number[] = [];
    for (let lat = -88; lat <= 88; lat += DOT_STEP) {
        for (let lng = -180; lng < 180; lng += DOT_STEP) {
            if (isLand(lat, lng)) latLng.push(lat, lng);
        }
    }

    const count = latLng.length / 2;
    const matrices = new Float32Array(count * 16);
    const dummy = new THREE.Object3D();
    const normal = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < count; i++) {
        toVec3(latLng[i * 2], latLng[i * 2 + 1], GLOBE_RADIUS, dummy.position);
        dummy.quaternion.setFromUnitVectors(UP, normal.copy(dummy.position).normalize());
        dummy.updateMatrix();
        dummy.matrix.toArray(matrices, i * 16);
    }
    return { count, latLng: new Float64Array(latLng), matrices };
};

let landPromise: Promise<LandPoints> | null = null;

/** 육지 점 위치. 첫 호출에서만 마스크를 읽고 이후엔 캐시를 돌려준다. 실패하면 점 없이 진행하고 다음 호출에서 다시 시도한다 */
export const loadLandPoints = (): Promise<LandPoints> =>
    (landPromise ??= readMask()
        .then(sampleLand)
        .catch(() => {
            landPromise = null;
            return EMPTY_LAND;
        }));

export interface LandDots {
    group: THREE.Group;
    dispose: () => void;
}

/** 방문 나라 근처는 파란 점, 나머지는 회색 점으로 InstancedMesh 두 개를 만든다 */
export const createLandDots = (land: LandPoints, visitedCentroids: [number, number][]): LandDots => {
    const r2 = VISIT_RADIUS * VISIT_RADIUS;
    const isNearVisited = (lat: number, lng: number) =>
        visitedCentroids.some(([clat, clng]) => (lat - clat) ** 2 + (lng - clng) ** 2 < r2);

    const gray: number[] = [];
    const blue: number[] = [];
    for (let i = 0; i < land.count; i++) {
        (isNearVisited(land.latLng[i * 2], land.latLng[i * 2 + 1]) ? blue : gray).push(i);
    }

    const group = new THREE.Group();
    const geometry = new THREE.CircleGeometry(DOT_SIZE, 5);
    const meshes: THREE.InstancedMesh[] = [];
    const addMesh = (indices: number[], color: number) => {
        if (!indices.length) return;
        const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
        const mesh = new THREE.InstancedMesh(geometry, material, indices.length);
        const { array } = mesh.instanceMatrix;
        indices.forEach((src, i) => array.set(land.matrices.subarray(src * 16, src * 16 + 16), i * 16));
        mesh.instanceMatrix.needsUpdate = true;
        group.add(mesh);
        meshes.push(mesh);
    };
    addMesh(gray, GRAY);
    addMesh(blue, ACCENT_HEX);

    return {
        group,
        dispose() {
            group.removeFromParent();
            meshes.forEach((m) => {
                (m.material as THREE.Material).dispose();
                m.dispose();
            });
            geometry.dispose();
        },
    };
};
