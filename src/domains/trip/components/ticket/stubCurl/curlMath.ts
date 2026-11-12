/**
 * 1-Day 패스 옆면 "위→아래 말림"(시안 A)의 순수 계산.
 * three.js에 의존하지 않아 테스트할 수 있고, 엔진은 이 값을 정점 버퍼에 그대로 쓴다.
 * 단위는 CSS px, 좌표는 조각 왼쪽 위가 (0,0)이고 v는 아래로 커진다.
 * 조각은 보는 쪽(+z)으로 말려 티켓 위로 넘어온다. 안쪽 면은 엔진이 같은 유리 재질로 그린다.
 */

const deg = (d: number) => (d * Math.PI) / 180;

export const CURL = {
    /** 접힘선의 진행 방향. 오른쪽으로 24° 기운 위쪽 → 오른쪽 위 모서리가 먼저 들린다 */
    dir: [Math.sin(deg(24)), -Math.cos(deg(24))] as const,
    /** 접히는 곳의 반지름 — 이 반지름으로만 휘고 나머지는 곧게 편다 */
    radius: 15,
    /** 원통을 이만큼 감은 뒤로는 접선 방향으로 곧게 뻗는다 */
    maxBend: deg(56),
    /** 끝까지 말린 뒤 조금 더 들어 올려 아래 모서리도 떨어지게 */
    overshoot: 14,
    segments: [24, 100] as const,
    peelMs: [0, 600] as const,
    /** 다 말리기 직전부터 오른쪽 아래로 툭 떨어지며 돈다 */
    fall: { startMs: 470, velocity: [150, 60, 40] as const, gravity: 4200, spin: [-1, 1.4, -2.2] as const },
    fadeMs: [720, 900] as const,
    /** 조각이 다 떨어진 뒤 이동 — 시안의 화면 전환(300ms)은 라우터가 대신한다 */
    endMs: 920,
} as const;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const progress = (t: number, [a, b]: readonly [number, number]) => clamp01((t - a) / (b - a));
const inOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

export interface CurlGrid {
    u: Float32Array;
    v: Float32Array;
    /** 접힘선 방향 거리. 가장 먼저 들리는 모서리가 0, 나머지는 음수 */
    d: Float32Array;
    /** 첫 모서리에서 마지막 모서리까지 접힘선이 지나가야 하는 거리 */
    range: number;
}

/** 평평한 격자(u,v)마다 접힘선까지의 거리를 미리 구해 둔다 */
export const createCurlGrid = (u: Float32Array, v: Float32Array): CurlGrid => {
    const [nx, ny] = CURL.dir;
    const d = new Float32Array(u.length);
    let max = -Infinity;
    let min = Infinity;
    for (let i = 0; i < u.length; i++) {
        d[i] = u[i] * nx + v[i] * ny;
        max = Math.max(max, d[i]);
        min = Math.min(min, d[i]);
    }
    for (let i = 0; i < d.length; i++) d[i] -= max;
    return { u, v, d, range: max - min };
};

/**
 * 접힘선이 f만큼 지나간 모양을 out(x,y,z 연속)에 쓴다.
 * 접힘선 너머(s>0)는 반지름 R 원통을 감고, maxBend 이후엔 접선으로 곧게 → 종이가 늘어나지 않는다.
 * z는 보는 쪽이 양수.
 */
export const deformCurl = (grid: CurlGrid, f: number, out: Float32Array) => {
    const [nx, ny] = CURL.dir;
    const R = CURL.radius;
    const sinM = Math.sin(CURL.maxBend);
    const cosM = Math.cos(CURL.maxBend);
    for (let i = 0; i < grid.u.length; i++) {
        const s = grid.d[i] + f;
        let x = grid.u[i];
        let y = grid.v[i];
        let z = 0;
        if (s > 0) {
            const phi = s / R;
            let along: number;
            if (phi < CURL.maxBend) {
                along = R * Math.sin(phi);
                z = R * (1 - Math.cos(phi));
            } else {
                const rest = s - R * CURL.maxBend;
                along = R * sinM + rest * cosM;
                z = R * (1 - cosM) + rest * sinM;
            }
            const k = along - s;
            x += nx * k;
            y += ny * k;
        }
        out[i * 3] = x;
        out[i * 3 + 1] = y;
        out[i * 3 + 2] = z;
    }
};

export interface CurlPose {
    /** 접힘선이 지나간 거리 */
    fold: number;
    /** 제자리 기준 이동(px, y는 위가 +) */
    offset: [number, number, number];
    rotation: [number, number, number];
    opacity: number;
}

/** t(ms) 시점의 말림 정도·낙하 위치·투명도 */
export const curlPose = (t: number, range: number): CurlPose => {
    const p = progress(t, CURL.peelMs);
    // 처음부터 살짝 움직이게 선형을 섞는다 — 순수 ease-in이면 탭 직후 멈춘 듯 보인다
    const fold = (0.25 * p + 0.75 * inOutSine(p)) * (range + CURL.overshoot);
    const { startMs, velocity, gravity, spin } = CURL.fall;
    const tau = Math.max(0, t - startMs) / 1000;
    return {
        fold,
        offset: [velocity[0] * tau, velocity[1] * tau - 0.5 * gravity * tau * tau, velocity[2] * tau],
        rotation: [spin[0] * tau, spin[1] * tau, spin[2] * tau],
        opacity: 1 - progress(t, CURL.fadeMs),
    };
};
