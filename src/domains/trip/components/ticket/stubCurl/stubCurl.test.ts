import { afterEach, describe, expect, it, vi } from 'vitest';

import { GLASS, parseLinearGradient, STUB_LAYERS } from '@/domains/trip/components/ticket/stubCurl/bakeStub';
import { createCurlGrid, CURL, curlPose, deformCurl } from '@/domains/trip/components/ticket/stubCurl/curlMath';
import { decideCurlTap, withinBudget } from '@/domains/trip/components/ticket/stubCurl/loadStubCurl';

describe('말림 탭 판단', () => {
    it('재생 중 탭은 무시한다', () => {
        expect(decideCurlTap({ playing: true, reducedMotion: false, hasStub: true })).toBe('ignore');
    });

    it('모션 줄이기·옆면 없음이면 효과 없이 바로 이동', () => {
        expect(decideCurlTap({ playing: false, reducedMotion: true, hasStub: true })).toBe('navigate');
        expect(decideCurlTap({ playing: false, reducedMotion: false, hasStub: false })).toBe('navigate');
    });

    it('그 밖에는 말림', () => {
        expect(decideCurlTap({ playing: false, reducedMotion: false, hasStub: true })).toBe('curl');
    });
});

describe('청크 대기 예산', () => {
    afterEach(() => vi.useRealTimers());

    it('시간 안에 오면 그 값', async () => {
        await expect(withinBudget(Promise.resolve('ok'), 150)).resolves.toBe('ok');
    });

    it('늦으면 null — 탭이 막히지 않는다', async () => {
        vi.useFakeTimers();
        const late = withinBudget(new Promise(() => {}), 150);
        vi.advanceTimersByTime(150);
        await expect(late).resolves.toBeNull();
    });

    it('실패해도 null', async () => {
        await expect(withinBudget(Promise.reject(new Error('offline')), 150)).resolves.toBeNull();
    });
});

describe('기본 그라디언트 읽기', () => {
    it('ticketView의 oklch 그라디언트', () => {
        expect(
            parseLinearGradient('linear-gradient(135deg, oklch(0.7 0.08 120) 0%, oklch(0.35 0.08 160) 100%)'),
        ).toEqual({
            angleDeg: 135,
            stops: [
                { color: 'oklch(0.7 0.08 120)', at: 0 },
                { color: 'oklch(0.35 0.08 160)', at: 1 },
            ],
        });
    });

    it('rgb() 안의 쉼표는 나누지 않고, 위치가 없으면 고르게 둔다', () => {
        expect(parseLinearGradient('linear-gradient(rgb(1, 2, 3), rgba(4, 5, 6, 0.5))')).toEqual({
            angleDeg: 180,
            stops: [
                { color: 'rgb(1, 2, 3)', at: 0 },
                { color: 'rgba(4, 5, 6, 0.5)', at: 1 },
            ],
        });
    });

    it('모르는 형식은 null', () => {
        expect(parseLinearGradient('none')).toBeNull();
        expect(parseLinearGradient('linear-gradient(to right, red, blue)')).toBeNull();
    });
});

describe('종이 말림 모양', () => {
    // 82×268 옆면을 2px 격자로
    const W = 82;
    const H = 268;
    const cols = W / 2 + 1;
    const rows = H / 2 + 1;
    const u = new Float32Array(cols * rows);
    const v = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
            u[r * cols + c] = c * 2;
            v[r * cols + c] = r * 2;
        }
    const grid = createCurlGrid(u, v);
    const at = (out: Float32Array, c: number, r: number) => out.subarray((r * cols + c) * 3, (r * cols + c) * 3 + 3);

    it('시작 프레임은 평평 — HTML 옆면과 같은 자리', () => {
        const out = new Float32Array(u.length * 3);
        deformCurl(grid, curlPose(0, grid.range).fold, out);
        for (let i = 0; i < u.length; i++) {
            expect(out[i * 3]).toBeCloseTo(u[i]);
            expect(out[i * 3 + 1]).toBeCloseTo(v[i]);
            expect(out[i * 3 + 2]).toBeCloseTo(0);
        }
    });

    it('오른쪽 위 모서리가 먼저 보는 쪽(+z)으로 들리고 왼쪽 아래는 아직 붙어 있다', () => {
        const out = new Float32Array(u.length * 3);
        deformCurl(grid, 60, out);
        expect(at(out, cols - 1, 0)[2]).toBeGreaterThan(0);
        expect(at(out, 0, rows - 1)[2]).toBeCloseTo(0);
    });

    it('종이가 늘어나지 않는다 — 이웃 정점 사이 거리가 그대로', () => {
        const out = new Float32Array(u.length * 3);
        deformCurl(grid, 160, out);
        for (let r = 0; r < rows - 1; r++) {
            const a = at(out, cols - 1, r);
            const b = at(out, cols - 1, r + 1);
            expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeLessThanOrEqual(2 + 1e-3);
            expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeGreaterThan(1.9);
        }
    });

    it('끝나는 시점에는 다 사라져 있다', () => {
        expect(curlPose(CURL.fadeMs[1], grid.range).opacity).toBe(0);
        expect(CURL.endMs).toBeGreaterThanOrEqual(CURL.fadeMs[1]);
    });
});

describe('말림 안쪽 면', () => {
    it('흰 종이·워터마크가 아니라 HTML 옆면과 같은 어두운 유리', () => {
        expect(GLASS).toBe('rgba(15, 23, 42, 0.58)');
        expect(STUB_LAYERS.back).toEqual(['backdrop', 'glass']);
    });

    it('글자·절취선은 앞면에만', () => {
        expect(STUB_LAYERS.front).toEqual(expect.arrayContaining(['text', 'perforation']));
        expect(STUB_LAYERS.back).not.toContain('text');
        expect(STUB_LAYERS.back).not.toContain('perforation');
    });
});
