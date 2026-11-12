/**
 * 감쇠 스프링(질량 1). framer-motion의 stiffness/damping 감각을 그대로 쓴다.
 * 프레임마다 step(dt)를 부르고, 목표는 set(), 즉시 이동은 snap()으로 바꾼다.
 */
export class Spring {
    x: number;
    target: number;
    private v = 0;

    constructor(
        value: number,
        private readonly stiffness = 220,
        private readonly damping = 26,
    ) {
        this.x = value;
        this.target = value;
    }

    set(target: number) {
        this.target = target;
    }

    snap(value: number) {
        this.x = value;
        this.target = value;
        this.v = 0;
    }

    step(dt: number) {
        // 반 스텝 두 번 — 프레임이 튀어 dt가 커져도 발산하지 않게
        const h = dt / 2;
        for (let i = 0; i < 2; i++) {
            const a = this.stiffness * (this.target - this.x) - this.damping * this.v;
            this.v += a * h;
            this.x += this.v * h;
        }
    }
}
