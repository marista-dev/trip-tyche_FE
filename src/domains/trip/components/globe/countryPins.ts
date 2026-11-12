/** 방문한 나라 핀: 파란 점 + 퍼지는 고리 + 탭 판정을 넓히는 투명 구 */
import * as THREE from 'three';

import { COUNTRY_CENTROIDS, GLOBE_RADIUS, toVec3 } from './globeGeo';

const ACCENT_HEX = 0x0ea5e9; // COLORS.ACCENT('#0ea5e9')의 숫자 표현
const PULSE_OPACITY = 0.6;

export interface CountryPins {
    /** 레이캐스트 대상. userData.nameEn에 나라 이름이 있다 */
    hitTargets: THREE.Mesh[];
    pinOf: (nameEn: string) => THREE.Object3D | undefined;
    /** 매 프레임 고리를 퍼뜨린다 */
    tick: () => void;
    dispose: () => void;
}

export const createCountryPins = (scene: THREE.Scene, nameEns: string[]): CountryPins => {
    const pinGeo = new THREE.SphereGeometry(0.028, 12, 12);
    const hitGeo = new THREE.SphereGeometry(0.075, 8, 8);
    const pulseGeo = new THREE.RingGeometry(0.038, 0.06, 32);
    const pinMat = new THREE.MeshBasicMaterial({ color: ACCENT_HEX });
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const UP = new THREE.Vector3(0, 0, 1);

    const group = new THREE.Group();
    const pins = new Map<string, THREE.Mesh>();
    const hitTargets: THREE.Mesh[] = [];
    const pulses: { mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; t: number }[] = [];

    nameEns.forEach((nameEn) => {
        const coords = COUNTRY_CENTROIDS[nameEn];
        if (!coords) return;
        const pos = toVec3(coords[0], coords[1], GLOBE_RADIUS);

        const pin = new THREE.Mesh(pinGeo, pinMat);
        pin.position.copy(pos);
        pins.set(nameEn, pin);

        // 보이는 모습은 그대로 두고 탭 판정 범위만 약 2.7배로 넓힌다
        const hit = new THREE.Mesh(hitGeo, hitMat);
        hit.position.copy(pos);
        hit.userData = { nameEn };
        hitTargets.push(hit);

        const pulse = new THREE.Mesh(
            pulseGeo,
            new THREE.MeshBasicMaterial({
                color: ACCENT_HEX,
                transparent: true,
                opacity: PULSE_OPACITY,
                side: THREE.DoubleSide,
                depthWrite: false,
            }),
        );
        pulse.position.copy(pos);
        pulse.quaternion.setFromUnitVectors(UP, pos.clone().normalize());
        pulses.push({ mesh: pulse, t: Math.random() });

        group.add(pin, hit, pulse);
    });
    scene.add(group);

    return {
        hitTargets,
        pinOf: (nameEn) => pins.get(nameEn),
        tick() {
            pulses.forEach((p) => {
                p.t = (p.t + 0.007) % 1;
                p.mesh.scale.setScalar(1 + p.t * 2.2);
                p.mesh.material.opacity = PULSE_OPACITY * (1 - p.t);
            });
        },
        dispose() {
            group.removeFromParent();
            pulses.forEach((p) => p.mesh.material.dispose());
            [pinGeo, hitGeo, pulseGeo, pinMat, hitMat].forEach((r) => r.dispose());
        },
    };
};
