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

const STUB_VERTEX_SHADER = `varying vec2 vUv; varying vec3 vN;
void main(){ vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// 평평한 면은 텍스처 색 그대로(=HTML과 동일)가 되도록 조명을 정규화하고, 휘어진 면만 밝기가 바뀐다
const STUB_FRAGMENT_SHADER = `uniform sampler2D map; uniform sampler2D backMap; uniform float backShade; uniform float opacity;
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

// 같은 지오메트리를 빛 방향으로 바닥(z≈0)에 눌러 그린다
const SHADOW_VERTEX_SHADER = `uniform vec2 k; varying float h; varying vec2 vUv;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); h = w.z; w.xy += vec2(k.x, -k.y) * w.z; w.z = 0.4; vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * w; }`;
const SHADOW_FRAGMENT_SHADER = `uniform float opacity; uniform vec2 size; varying float h; varying vec2 vUv;
void main(){ float soft = clamp(h * 0.4, 2.0, 26.0); vec2 d = min(vUv, 1.0 - vUv) * size;
  float e = smoothstep(0.0, soft, min(d.x, d.y));
  float a = 0.26 * smoothstep(1.0, 28.0, h) * (1.0 - 0.5 * smoothstep(80.0, 260.0, h)) * e * opacity;
  gl_FragColor = vec4(vec3(0.059, 0.09, 0.165) * a, a); }`;

const BACK_FACE_SHADE = 0.82;
const SHADOW_LIGHT_SLANT = new Vector2(0.32, 0.5);
/** 말린 조각·그림자가 움직일 여유(px). 아래로 떨어지므로 아래쪽이 가장 넓다 */
const OVERLAY_MARGIN = { left: 90, right: 150, top: 90, bottom: 440 };
const OVERLAY_Z_INDEX = '1000';
const MAX_PIXEL_RATIO = 2;
const TEXTURE_ANISOTROPY = 4;
const CAMERA_FOV_DEG = 30;
const CAMERA_NEAR = 10;
const CAMERA_FAR = 8000;

export interface CurlScene {
    render: (elapsedMs: number) => void;
    dispose: () => void;
}

const toStubTexture = (source: HTMLCanvasElement) => {
    const texture = new CanvasTexture(source);
    texture.premultiplyAlpha = true;
    texture.anisotropy = TEXTURE_ANISOTROPY;
    texture.colorSpace = NoColorSpace;
    return texture;
};

const getOverlayRect = (stubRect: DOMRect) => {
    const left = Math.max(0, Math.floor(stubRect.left - OVERLAY_MARGIN.left));
    const top = Math.max(0, Math.floor(stubRect.top - OVERLAY_MARGIN.top));
    const width = Math.min(window.innerWidth, Math.ceil(stubRect.right + OVERLAY_MARGIN.right)) - left;
    const height = Math.min(window.innerHeight, Math.ceil(stubRect.bottom + OVERLAY_MARGIN.bottom)) - top;
    return { left, top, width, height };
};

const createOverlayCanvas = ({ left, top, width, height }: ReturnType<typeof getOverlayRect>) => {
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: 'none',
        zIndex: OVERLAY_Z_INDEX,
    });
    canvas.setAttribute('aria-hidden', 'true');
    return canvas;
};

/** 카메라는 화면 전체 기준(1 unit = 1 CSS px)이고 setViewOffset으로 오버레이 영역만 그린다. WebGL을 못 쓰면 던진다 */
export const createCurlScene = (stubRect: DOMRect, baked: BakedStub, onContextLost: () => void): CurlScene => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const overlay = getOverlayRect(stubRect);
    const canvas = createOverlayCanvas(overlay);

    const handleContextLost = (event: Event) => {
        event.preventDefault();
        onContextLost();
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);

    let renderer: WebGLRenderer | null = null;
    const disposables: { dispose: () => void }[] = [];
    const dispose = () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        disposables.forEach((resource) => resource.dispose());
        if (renderer) {
            renderer.dispose();
            // 안드로이드 WebView는 컨텍스트 수 제한이 있어 바로 반납한다
            renderer.forceContextLoss();
        }
        canvas.remove();
    };

    try {
        // 직접 만들어 넘겨야 실패 시 three가 콘솔 에러를 찍지 않는다
        const context = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true });
        if (!context) throw new Error('WebGL2 unavailable');
        renderer = new WebGLRenderer({ canvas, context });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
        renderer.setSize(overlay.width, overlay.height, false);
        renderer.setClearColor(0x000000, 0);

        const camera = new PerspectiveCamera(CAMERA_FOV_DEG, viewportWidth / viewportHeight, CAMERA_NEAR, CAMERA_FAR);
        const halfFovRadians = ((CAMERA_FOV_DEG / 2) * Math.PI) / 180;
        camera.position.set(0, 0, viewportHeight / 2 / Math.tan(halfFovRadians));
        camera.setViewOffset(viewportWidth, viewportHeight, overlay.left, overlay.top, overlay.width, overlay.height);

        const { width: stubWidth, height: stubHeight } = baked;
        const frontTexture = toStubTexture(baked.front);
        const backTexture = toStubTexture(baked.back);

        const stubMaterial = new ShaderMaterial({
            uniforms: {
                map: { value: frontTexture },
                backMap: { value: backTexture },
                backShade: { value: BACK_FACE_SHADE },
                opacity: { value: 1 },
            },
            vertexShader: STUB_VERTEX_SHADER,
            fragmentShader: STUB_FRAGMENT_SHADER,
            side: DoubleSide,
            transparent: true,
            premultipliedAlpha: true,
        });
        const shadowMaterial = new ShaderMaterial({
            uniforms: {
                opacity: { value: 1 },
                size: { value: new Vector2(stubWidth, stubHeight) },
                k: { value: SHADOW_LIGHT_SLANT },
            },
            vertexShader: SHADOW_VERTEX_SHADER,
            fragmentShader: SHADOW_FRAGMENT_SHADER,
            transparent: true,
            premultipliedAlpha: true,
            depthWrite: false,
        });
        const geometry = new PlaneGeometry(stubWidth, stubHeight, CURL.gridSegments[0], CURL.gridSegments[1]);
        disposables.push(frontTexture, backTexture, stubMaterial, shadowMaterial, geometry);

        const position = geometry.getAttribute('position') as BufferAttribute;
        position.setUsage(DynamicDrawUsage);
        const { count: vertexCount } = position;
        const u = new Float32Array(vertexCount);
        const v = new Float32Array(vertexCount);
        for (let i = 0; i < vertexCount; i++) {
            u[i] = position.getX(i) + stubWidth / 2;
            v[i] = stubHeight / 2 - position.getY(i);
        }
        const grid = createCurlGrid(u, v);
        const deformed = new Float32Array(vertexCount * 3);

        const stubMesh = new Mesh(geometry, stubMaterial);
        const shadowMesh = new Mesh(geometry, shadowMaterial);
        // 조각이 깊이를 먼저 써서 들린 부분 아래로만 그림자가 보인다
        stubMesh.renderOrder = 1;
        shadowMesh.renderOrder = 2;
        stubMesh.frustumCulled = shadowMesh.frustumCulled = false;
        const scene = new Scene();
        scene.add(stubMesh, shadowMesh);

        const restX = stubRect.left + stubWidth / 2 - viewportWidth / 2;
        const restY = viewportHeight / 2 - (stubRect.top + stubHeight / 2);

        document.body.appendChild(canvas);

        const render = (elapsedMs: number) => {
            const pose = curlPose(elapsedMs, grid.foldRange);
            deformCurl(grid, pose.foldProgress, deformed);
            for (let i = 0; i < vertexCount; i++) {
                position.setXYZ(
                    i,
                    deformed[i * 3] - stubWidth / 2,
                    stubHeight / 2 - deformed[i * 3 + 1],
                    deformed[i * 3 + 2],
                );
            }
            position.needsUpdate = true;
            geometry.computeVertexNormals();

            stubMesh.position.set(restX + pose.offset[0], restY + pose.offset[1], pose.offset[2]);
            stubMesh.rotation.set(...pose.rotation);
            shadowMesh.position.copy(stubMesh.position);
            shadowMesh.rotation.copy(stubMesh.rotation);
            stubMaterial.uniforms.opacity.value = pose.opacity;
            shadowMaterial.uniforms.opacity.value = pose.opacity;
            renderer!.render(scene, camera);
        };

        return { render, dispose };
    } catch (error) {
        dispose();
        throw error;
    }
};
