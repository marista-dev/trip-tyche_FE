// 단위는 CSS px. 원점은 조각 왼쪽 위, v는 아래로 커지고 z는 보는 쪽이 +
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const FOLD_TILT_DEG = 24;

export const CURL = {
    /** 오른쪽으로 기운 위쪽 방향 — 오른쪽 위 모서리가 먼저 들린다 */
    foldDirection: [Math.sin(toRadians(FOLD_TILT_DEG)), -Math.cos(toRadians(FOLD_TILT_DEG))] as const,
    radius: 15,
    /** 원통을 이만큼 감은 뒤로는 접선 방향으로 곧게 뻗는다 */
    maxBend: toRadians(56),
    /** 끝까지 말린 뒤 더 들어 올려 아래 모서리도 떨어지게 */
    overshoot: 14,
    gridSegments: [24, 100] as const,
    peelMs: [0, 600] as const,
    fall: { startMs: 470, velocity: [150, 60, 40] as const, gravity: 4200, spin: [-1, 1.4, -2.2] as const },
    fadeMs: [720, 900] as const,
    endMs: 920,
} as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const progressBetween = (t: number, [from, to]: readonly [number, number]) => clamp01((t - from) / (to - from));
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

export interface CurlGrid {
    u: Float32Array;
    v: Float32Array;
    /** 접힘선 방향 거리. 가장 먼저 들리는 모서리가 0, 나머지는 음수 */
    foldDistance: Float32Array;
    foldRange: number;
}

export const createCurlGrid = (u: Float32Array, v: Float32Array): CurlGrid => {
    const [dirX, dirY] = CURL.foldDirection;
    const foldDistance = new Float32Array(u.length);
    let max = -Infinity;
    let min = Infinity;
    for (let i = 0; i < u.length; i++) {
        foldDistance[i] = u[i] * dirX + v[i] * dirY;
        max = Math.max(max, foldDistance[i]);
        min = Math.min(min, foldDistance[i]);
    }
    for (let i = 0; i < foldDistance.length; i++) foldDistance[i] -= max;
    return { u, v, foldDistance, foldRange: max - min };
};

/** 접힘선 너머는 원통을 감고 maxBend 이후엔 접선으로 곧게 — 길이가 보존된다. out은 x,y,z 연속 */
export const deformCurl = (grid: CurlGrid, foldProgress: number, out: Float32Array) => {
    const [dirX, dirY] = CURL.foldDirection;
    const { radius, maxBend } = CURL;
    const sinMaxBend = Math.sin(maxBend);
    const cosMaxBend = Math.cos(maxBend);
    for (let i = 0; i < grid.u.length; i++) {
        const pastFold = grid.foldDistance[i] + foldProgress;
        let x = grid.u[i];
        let y = grid.v[i];
        let z = 0;
        if (pastFold > 0) {
            const bendAngle = pastFold / radius;
            let along: number;
            if (bendAngle < maxBend) {
                along = radius * Math.sin(bendAngle);
                z = radius * (1 - Math.cos(bendAngle));
            } else {
                const straightPart = pastFold - radius * maxBend;
                along = radius * sinMaxBend + straightPart * cosMaxBend;
                z = radius * (1 - cosMaxBend) + straightPart * sinMaxBend;
            }
            const pullBack = along - pastFold;
            x += dirX * pullBack;
            y += dirY * pullBack;
        }
        out[i * 3] = x;
        out[i * 3 + 1] = y;
        out[i * 3 + 2] = z;
    }
};

export interface CurlPose {
    foldProgress: number;
    /** 제자리 기준 이동(px, y는 위가 +) */
    offset: [number, number, number];
    rotation: [number, number, number];
    opacity: number;
}

export const curlPose = (t: number, foldRange: number): CurlPose => {
    const peel = progressBetween(t, CURL.peelMs);
    // 선형을 섞어 탭 직후부터 움직이게 한다 — 순수 ease-in이면 멈춘 듯 보인다
    const foldProgress = (0.25 * peel + 0.75 * easeInOutSine(peel)) * (foldRange + CURL.overshoot);
    const { startMs, velocity, gravity, spin } = CURL.fall;
    const fallSeconds = Math.max(0, t - startMs) / 1000;
    return {
        foldProgress,
        offset: [
            velocity[0] * fallSeconds,
            velocity[1] * fallSeconds - 0.5 * gravity * fallSeconds * fallSeconds,
            velocity[2] * fallSeconds,
        ],
        rotation: [spin[0] * fallSeconds, spin[1] * fallSeconds, spin[2] * fallSeconds],
        opacity: 1 - progressBetween(t, CURL.fadeMs),
    };
};
