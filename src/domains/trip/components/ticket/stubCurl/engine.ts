import {
    BufferAttribute,
    CanvasTexture,
    DoubleSide,
    DynamicDrawUsage,
    Mesh,
    NoColorSpace,
    PerspectiveCamera,
    PlaneGeometry,
    Scene,
    ShaderMaterial,
    Vector2,
    WebGLRenderer,
} from 'three';

import { BakedStub } from './bakeStub';
import { createCurlGrid, CURL, curlPose, deformCurl } from './curlMath';

const STUB_VS = `varying vec2 vUv; varying vec3 vN;
void main(){ vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/* 평평한 면은 텍스처 색 그대로(=HTML과 동일), 휘어진 면만 밝아지거나 어두워지게 정규화. 바닥값이 있어 회색으로 죽지 않는다.
   안쪽 면(뒷면)은 글자 없는 같은 유리(backMap)를 조금 어둡게 — 흰 종이로 보이지 않고 같은 조각으로 읽히게 */
const STUB_FS = `uniform sampler2D map; uniform sampler2D backMap; uniform float backShade; uniform float opacity;
varying vec2 vUv; varying vec3 vN;
void main(){
  vec4 f = texture2D(map, vUv);
  if (f.a < 0.02) discard;
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 L = normalize(vec3(-0.4, 0.6, 1.0));
  vec3 base = gl_FrontFacing ? f.rgb : texture2D(backMap, vUv).rgb * f.a * backShade;
  float flatL = 0.42 + 0.58 * L.z;
  float sh = clamp((0.42 + 0.58 * max(dot(n, L), 0.0)) / flatL, 0.6, 1.12);
  vec3 Hv = normalize(L + vec3(0.0, 0.0, 1.0));
  float sp = max(pow(max(dot(n, Hv), 0.0), 48.0) - pow(Hv.z, 48.0), 0.0) * (gl_FrontFacing ? 0.32 : 0.12);
  gl_FragColor = vec4((base * sh + sp * f.a) * opacity, f.a * opacity);
}`;

/* 그림자: 같은 지오메트리를 빛 방향으로 바닥(z≈0)에 눌러 그림. 높이 뜰수록 진하다가 흐려지고 가장자리가 퍼진다 */
const SHADOW_VS = `uniform vec2 k; varying float h; varying vec2 vUv;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); h = w.z; w.xy += vec2(k.x, -k.y) * w.z; w.z = 0.4; vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * w; }`;
const SHADOW_FS = `uniform float opacity; uniform vec2 size; varying float h; varying vec2 vUv;
void main(){ float soft = clamp(h * 0.4, 2.0, 26.0); vec2 d = min(vUv, 1.0 - vUv) * size;
  float e = smoothstep(0.0, soft, min(d.x, d.y));
  float a = 0.26 * smoothstep(1.0, 28.0, h) * (1.0 - 0.5 * smoothstep(80.0, 260.0, h)) * e * opacity;
  gl_FragColor = vec4(vec3(0.059, 0.09, 0.165) * a, a); }`;

/** 말림 안쪽 면을 앞면보다 이만큼 어둡게 — 깊이감 */
const BACK_SHADE = 0.82;
/** 말린 조각·그림자가 움직일 여유(px). 아래로 떨어지므로 아래쪽이 가장 넓다 */
const MARGIN = { left: 90, right: 150, top: 90, bottom: 440 };
const MAX_PIXEL_RATIO = 2;

export interface CurlScene {
    /** t(ms) 시점을 그린다 */
    render: (t: number) => void;
    dispose: () => void;
}

/**
 * 옆면 자리에 고정 오버레이 캔버스를 띄우고 말림 장면을 만든다.
 * 카메라는 화면 전체 기준(1 unit = 1 CSS px)이고, setViewOffset으로 오버레이 영역만 그린다.
 * WebGL을 못 쓰면 여기서 던진다 → 호출부가 효과 없이 이동.
 */
export const createCurlScene = (stubRect: DOMRect, baked: BakedStub, onContextLost: () => void): CurlScene => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(0, Math.floor(stubRect.left - MARGIN.left));
    const top = Math.max(0, Math.floor(stubRect.top - MARGIN.top));
    const width = Math.min(vw, Math.ceil(stubRect.right + MARGIN.right)) - left;
    const height = Math.min(vh, Math.ceil(stubRect.bottom + MARGIN.bottom)) - top;

    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: 'none',
        // 목록·헤더 위, 토스트·모달과는 겹칠 일이 없을 만큼 짧게만 뜬다
        zIndex: '1000',
    });
    canvas.setAttribute('aria-hidden', 'true');
    const handleLost = (e: Event) => {
        e.preventDefault();
        onContextLost();
    };
    canvas.addEventListener('webglcontextlost', handleLost);

    let renderer: WebGLRenderer | null = null;
    const disposables: { dispose: () => void }[] = [];
    const dispose = () => {
        canvas.removeEventListener('webglcontextlost', handleLost);
        disposables.forEach((d) => d.dispose());
        if (renderer) {
            renderer.dispose();
            // 안드로이드 WebView는 컨텍스트 수 제한이 있어 바로 반납한다
            renderer.forceContextLoss();
        }
        canvas.remove();
    };

    try {
        // 컨텍스트를 직접 만들어 넘긴다 — 못 만들면 three가 콘솔 에러를 찍기 전에 조용히 대체 경로로
        const context = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true });
        if (!context) throw new Error('WebGL2 unavailable');
        renderer = new WebGLRenderer({ canvas, context });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
        renderer.setSize(width, height, false);
        renderer.setClearColor(0x000000, 0);

        const camera = new PerspectiveCamera(30, vw / vh, 10, 8000);
        camera.position.set(0, 0, vh / 2 / Math.tan((15 * Math.PI) / 180));
        camera.setViewOffset(vw, vh, left, top, width, height);

        const { width: cw, height: ch } = baked;
        const toTexture = (source: HTMLCanvasElement) => {
            const t = new CanvasTexture(source);
            t.premultiplyAlpha = true;
            t.anisotropy = 4;
            t.colorSpace = NoColorSpace;
            return t;
        };
        const texture = toTexture(baked.canvas);
        const backTexture = toTexture(baked.back);

        const material = new ShaderMaterial({
            uniforms: {
                map: { value: texture },
                backMap: { value: backTexture },
                backShade: { value: BACK_SHADE },
                opacity: { value: 1 },
            },
            vertexShader: STUB_VS,
            fragmentShader: STUB_FS,
            side: DoubleSide,
            transparent: true,
            premultipliedAlpha: true,
        });
        const shadowMaterial = new ShaderMaterial({
            uniforms: {
                opacity: { value: 1 },
                size: { value: new Vector2(cw, ch) },
                k: { value: new Vector2(0.32, 0.5) },
            },
            vertexShader: SHADOW_VS,
            fragmentShader: SHADOW_FS,
            transparent: true,
            premultipliedAlpha: true,
            depthWrite: false,
        });
        const geometry = new PlaneGeometry(cw, ch, CURL.segments[0], CURL.segments[1]);
        disposables.push(texture, backTexture, material, shadowMaterial, geometry);

        const position = geometry.getAttribute('position') as BufferAttribute;
        position.setUsage(DynamicDrawUsage);
        const { count } = position;
        const u = new Float32Array(count);
        const v = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            u[i] = position.getX(i) + cw / 2;
            v[i] = ch / 2 - position.getY(i);
        }
        const grid = createCurlGrid(u, v);
        const deformed = new Float32Array(count * 3);

        const mesh = new Mesh(geometry, material);
        const shadow = new Mesh(geometry, shadowMaterial);
        // 조각이 깊이를 먼저 써서, 들린 조각 아래로만 그림자가 보인다
        mesh.renderOrder = 1;
        shadow.renderOrder = 2;
        mesh.frustumCulled = shadow.frustumCulled = false;
        const scene = new Scene();
        scene.add(mesh, shadow);

        // 화면 중심이 원점, y는 위가 +
        const homeX = stubRect.left + cw / 2 - vw / 2;
        const homeY = vh / 2 - (stubRect.top + ch / 2);

        document.body.appendChild(canvas);

        const render = (t: number) => {
            const pose = curlPose(t, grid.range);
            deformCurl(grid, pose.fold, deformed);
            for (let i = 0; i < count; i++) {
                position.setXYZ(i, deformed[i * 3] - cw / 2, ch / 2 - deformed[i * 3 + 1], deformed[i * 3 + 2]);
            }
            position.needsUpdate = true;
            geometry.computeVertexNormals();

            mesh.position.set(homeX + pose.offset[0], homeY + pose.offset[1], pose.offset[2]);
            mesh.rotation.set(...pose.rotation);
            shadow.position.copy(mesh.position);
            shadow.rotation.copy(mesh.rotation);
            material.uniforms.opacity.value = pose.opacity;
            shadowMaterial.uniforms.opacity.value = pose.opacity;
            renderer!.render(scene, camera);
        };

        return { render, dispose };
    } catch (error) {
        dispose();
        throw error;
    }
};
