# 04. Google Maps 앱 전용 API 키 분리

> 상위: [Phase 0 README](README.md) · 체크리스트: `app-capacitor-checklist.md` 0-4
> 성격: 인프라(콘솔 작업 중심) · 선행 조건 없음 · **리드타임이 있으니 먼저 착수 권장**

## 문제

현재 Google Maps JS API 키는 하나이고, **HTTP referrer 제한**으로 보호하고 있다. 이 방식은 웹에서는 잘 동작하지만 **Capacitor WebView에는 통하지 않는다.**

앱의 WebView는 `https://localhost`(안드로이드, `server.androidScheme: 'https'` 기준) origin으로 요청을 보낸다. 실제 도메인이 아니므로 기존 referrer 화이트리스트로는 앱을 허용할 수 없고, `localhost`를 화이트리스트에 넣으면 **누구나 로컬에서 흉내낼 수 있는 구멍**이 된다.

키를 분리하지 않고 그대로 앱을 빌드하면, **웹 키가 APK 안에 그대로 박힌 채 배포된다.** APK는 누구나 뜯어볼 수 있고, 배포 후에는 회수가 불가능하다. 키를 교체하려면 웹까지 함께 영향을 받는다.

## 근거

### 키를 읽는 곳은 단 한 군데

[`src/shared/constants/map.ts:6`](../../src/shared/constants/map.ts#L6):

```ts
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export const GOOGLE_MAPS_CONFIG = {
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'] as Libraries,
    version: 'weekly',
    language: 'ko',
    region: 'KR',
} as const;
```

저장소 전체에서 `VITE_GOOGLE_MAPS_API_KEY`의 다른 참조는 없다. `index.html`에 스크립트 태그도 없고, 로딩은 전적으로 `useLoadScript`(`@react-google-maps/api`)를 통한 런타임 방식이다.

### ⚠️ 런타임 분기가 까다로운 이유

`GOOGLE_MAPS_CONFIG`는 모듈 스코프의 `as const` 객체이고, `useLoadScript`는 **서로 다른 옵션으로 다시 호출되면 예외를 던진다** ("Loader must not be called again with different options"). 호출 지점이 6곳이라 분기가 조금이라도 흔들리면 지도 전체가 죽는다.

호출 지점: `useMapControl.ts`, `useReverseGeocode.ts`, `useAddressAggregation.ts`, `ImageByDatePage.tsx`, `ImageByPinpointPage.tsx`, 그리고 [`MainPage.tsx:27`](../../src/pages/MainPage.tsx#L27)(프리워밍).

### 환경변수 현황

| 파일 | git 추적 | 내용 |
|---|---|---|
| `.env` | ✗ | `VITE_API_BASE_URL`, `VITE_WEBSOCKET_URL`, `VITE_GOOGLE_MAPS_MAP_ID` (**API 키 없음**) |
| `.env.local` | ✗ | 위 3개 + `VITE_GOOGLE_MAPS_API_KEY` |
| `.env.example` | ✓ | 4개 키 이름 전부 (템플릿) |

`.gitignore`는 `.env`, `.env.*`, `!.env.example` 패턴이다. 프로덕션 값은 Vercel 프로젝트 설정에 있고, `.github/workflows/deploy.yml`에는 `VITE_*`가 전혀 없다.

## 개선 방안 — 빌드타임 `--mode app` 주입

**코드 변경 0.** Vite가 `--mode <name>` 빌드에서 `.env.<name>` 파일을 자동으로 로드하고, 그 우선순위가 `.env.local`보다 높다는 성질을 이용한다.

```
우선순위(높음 → 낮음):  .env.app.local  >  .env.app  >  .env.local  >  .env
```

앱 빌드는 어차피 웹과 별도로 돌아가므로(`vite build && cap sync`) 추가 부담이 없고, `map.ts`에 분기를 넣지 않아 `useLoadScript` 제약도 원천적으로 피한다. Capacitor가 아직 설치되지 않은 Phase 0 시점에도 성립한다.

> 런타임 분기(`isNative()`) 방식은 `@capacitor/core` 설치 이후에만 가능해 0-4가 Phase 1로 밀리고, 모듈 스코프 제약도 직접 감당해야 한다. 그래서 채택하지 않는다.

### 작업 순서

**1) Google Cloud 콘솔 — 앱 전용 키 발급**

- [x] **웹 키와 동일한 GCP 프로젝트**에서 새 API 키 생성 (아래 Map ID 항목 참조)
- [x] **API 제한**: Maps JavaScript API, Places API, Geocoding API 세 개만 허용
  - Places는 `libraries: ['places']`(SearchPlaceInput), Geocoding은 `useReverseGeocode.ts`·`useAddressAggregation.ts`가 사용
- [x] **애플리케이션 제한**: 아래 "정직한 한계"를 읽고 결정. 우선 `https://localhost/*` referrer 제한을 걸어보고, Phase 1에서 실기기 동작을 확인한 뒤 조정
  - ⚠️ Phase 1-4(에뮬레이터 첫 구동)에서 `RefererNotAllowedMapError` 없이 지도가 뜨는지 **반드시 재확인**. 막히면 referrer 제한을 풀고 쿼터·알림으로만 통제한다
- [x] **할당량 상한** 설정 — 일일 요청 수를 예상 사용량의 2~3배로 제한
- [x] **예산 알림** 설정 — 임계값 초과 시 메일 수신

> 알림 임계값을 정할 때: [`MainPage.tsx:27`](../../src/pages/MainPage.tsx#L27)이 지도 진입 전 프리워밍으로 스크립트를 로드한다. 따라서 앱 키의 사용량은 *지도 페이지 방문 수*가 아니라 **세션 수**에 가깝게 움직인다.

**2) `.env.app` 준비**

로컬에 `.env.app` 생성(gitignore 대상):

```
VITE_GOOGLE_MAPS_API_KEY=<앱 전용 키>
```

나머지 변수(`VITE_API_BASE_URL` 등)는 `.env`/`.env.local`에서 상속되므로 **다시 쓰지 않는다.** 앱에서 다른 값을 써야 하는 변수가 생기면 그때 추가한다.

**3) 커밋용 템플릿 추가**

- [ ] `.env.app.example` 생성 (키 이름과 주석만, 값은 비움)
- [ ] `.gitignore`에 예외 한 줄 추가: `!.env.app.example`

**4) 빌드 스크립트 연결 — Phase 1-2에서**

Capacitor 설치 시 추가할 스크립트에 모드를 반영한다:

```jsonc
"cap:sync": "vite build --mode app && cap sync"
```

Phase 0 시점에는 스크립트가 아직 없으므로, **이 문서에 기록해두고 Phase 1-2에서 반영**한다. 그때까지는 다음으로 수동 확인할 수 있다:

```bash
npx vite build --mode app
```

**5) 확인 — 앱 빌드에 앱 키가 들어갔는가**

```bash
npx vite build --mode app
grep -o "AIza[0-9A-Za-z_-]\{35\}" dist/assets/*.js | sort -u
```

출력된 키가 **앱 전용 키**여야 한다. 웹 키가 보이면 `.env.app`이 로드되지 않은 것이다.

### Map ID를 함께 분리해야 하는가 — 아니오(권장)

`VITE_GOOGLE_MAPS_MAP_ID`는 5개 파일에서 기능 게이트로 쓰인다. 특히 [`CinematicDroneMap.tsx:224`](../../src/domains/route/components/CinematicDroneMap.tsx#L224)는 Map ID가 없으면 `onVectorUnavailable()`로 빠져 **드론뷰 자체가 사라진다.**

Map ID는 **키가 아니라 GCP 프로젝트에 귀속**된다. 따라서:

- **같은 프로젝트에서 키만 추가 발급하면** → Map ID는 그대로 유효, 분리 불필요 ✅ (권장)
- 다른 프로젝트에서 키를 만들면 → Map ID도 그 프로젝트에서 새로 만들어 `.env.app`에 함께 넣어야 하고, 빠뜨리면 드론뷰가 조용히 사라진다

특별한 이유가 없다면 **같은 프로젝트에서 키만 추가**한다.

### ⚠️ 정직한 한계

키를 분리해도 **앱 키를 강하게 보호할 수는 없다.**

- WebView에서 도는 것은 Maps **JavaScript** API다. 안드로이드 앱 제한(패키지명 + SHA-1 지문)은 Maps SDK for Android에만 적용되고 JS API 호출에는 적용되지 않는다
- referrer 제한을 `https://localhost/*`로 걸어도, referrer는 클라이언트가 보내는 값이라 위조 가능하다. 자동화된 스크래핑을 조금 걸러줄 뿐이다
- APK를 뜯으면 키는 결국 보인다

**그래서 분리의 목적은 차단이 아니라 피해 범위 통제다:**

| 목적 | 효과 |
|---|---|
| 블래스트 반경 격리 | 앱 키가 유출·남용돼도 웹 서비스는 무사. 앱 키만 회수·교체하면 된다 |
| 할당량 상한 | 남용이 있어도 청구 금액이 상한에서 멈춘다 |
| 예산 알림 | 이상 사용을 조기에 인지 |
| API 제한 | 유출돼도 Maps/Places/Geocoding 외 다른 GCP 서비스는 호출 불가 |

## 변경 파일

| 파일 | 변경 |
|---|---|
| `.env.app` | **신규**(로컬 전용, git 미추적) — 앱 키 |
| `.env.app.example` | **신규**(커밋) — 템플릿 |
| `.gitignore` | `!.env.app.example` 한 줄 추가 |
| `package.json` | (Phase 1-2에서) `cap:sync`에 `--mode app` 반영 |

**소스 코드 변경 없음.** `map.ts`는 그대로다.

## 검증

- [x] `npx vite build --mode app` 후 번들에서 추출한 키가 앱 전용 키다 (위 5번 명령)
- [x] `npm run build`(모드 없음) 후 번들의 키는 **여전히 웹 키**다 — 웹 배포에 영향이 없어야 한다
- [x] Google Cloud 콘솔에서 앱 키의 API 제한·할당량·예산 알림이 설정되어 있다
- [x] `.env.app`이 git에 잡히지 않는다 (`git status`에 안 보임)
- [x] `.env.app.example`은 커밋 대상으로 잡힌다 — **값이 아닌 플레이스홀더만** 들어 있어야 한다
- [ ] (Phase 1 이후) 실기기에서 지도·드론뷰가 정상 렌더되고, 콘솔에 `RefererNotAllowedMapError`가 없다

## 리스크

| 리스크 | 대응 |
|---|---|
| `.env.app` 누락 상태로 앱 빌드 → 웹 키가 APK에 박힘 | 5번 grep 확인을 릴리스 체크리스트에 넣는다. `map.ts`는 키가 없어도 `''`로 조용히 넘어가므로(에러 없음) **자동 감지가 안 된다** |
| 다른 GCP 프로젝트에서 키 발급 → 드론뷰 소실 | 같은 프로젝트에서 키만 추가 발급 |
| 앱 키 유출 | 원천 차단 불가. 할당량 상한 + 알림으로 피해 통제 (위 "정직한 한계") |
| 팀원이 `.env.app` 없이 앱 빌드 | `.env.app.example`과 이 문서로 안내 |
