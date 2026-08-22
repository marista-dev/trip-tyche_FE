# Capacitor Android 앱 — 실행 체크리스트

> 작성일: 2026-08-22 · 전제: **Capacitor 7 + Android 단독 선출시** (결정 근거: `app-release-strategy.md` §0)
> 상세 스펙은 `app-frontend-tasks.md`(FE) / `backend-prd-app-release.md`(BE) 참조. 이 문서는 **실행 순서 추적용**.
>
> **사용 규칙**
> - 위에서 아래 순서로 진행한다. Phase 안에서도 번호 순서가 의존 순서다.
> - **체크박스 1개 = 작업 단위 1개** — 커밋/PR 하나로 완결되고, 그 자체로 검증 가능한 크기로 나눴다.
>   각 항목의 `✓기준`이 충족되면 체크한다.
> - `[BE 의존]` = 백엔드 작업(Phase 6, **추후 실행**) 완료 전에는 끝까지 검증 불가.
>   FE 쪽 골격까지 만들고 표시해 둔다.

---

## Phase 0. 선행 정리 (플랫폼 무관 — Capacitor 설치 전에 처리)

> 📄 **상세 개선 계획: [`phase-0-cleanup/`](phase-0-cleanup/README.md)** — 각 항목의 문제·근거·설계·검증
> 순서: 01·04는 독립(병렬 가능), **02 → 03**은 같은 파일을 건드리므로 순서 유지

- [x] **0-1. 미사용 의존성 제거** → [상세](phase-0-cleanup/01-remove-unused-deps.md)
  `package.json`에서 `@deck.gl/core`·`geo-layers`·`google-maps`·`layers`·`mesh-layers` 5종과 `browser-image-compression` 제거.
  ✓기준: `npm run build` 성공, `src/` 어디서도 import 없음 확인(현재 0건).

- [x] **0-2. EXIF 촬영시각 태그 수정** — `src/libs/utils/exif.ts` → [상세](phase-0-cleanup/02-exif-datetime-fix.md)
  `extractDateFromImage`가 `0th`/`ImageIFD.DateTime`(저장시각)을 읽는 것을 `Exif`/`ExifIFD.DateTimeOriginal`(촬영시각) 우선, 없으면 기존 태그 폴백으로 수정.
  ✓기준: 편집된 사진(저장시각≠촬영시각)으로 촬영시각이 추출됨.

- [x] **0-3. 메타데이터 추출 메모리 개선** — `src/libs/utils/image.ts`, `src/libs/utils/exif.ts` → [상세](phase-0-cleanup/03-metadata-memory.md)
  파일당 base64 전체 읽기 2회(위치·날짜 각각) → **1회 읽어 EXIF 객체 공유**, `Promise.all` 전체 동시 실행 → **동시성 상한(예: 5)** 도입. 진행률 콜백 유지.
  ✓기준: 기존 업로드 플로우 회귀 없음(수십 장 업로드 정상), 파일당 FileReader 호출 1회.

- [x] **0-4. Google Maps 앱 전용 API 키 분리** → [상세](phase-0-cleanup/04-maps-api-key.md)
  Google Cloud 콘솔에서 앱용 키 신규 발급(**웹과 동일 GCP 프로젝트**에서 키만 추가 — Map ID 유지), API 제한·쿼터 상한·예산 알림 설정. 주입은 **빌드타임 `--mode app` + `.env.app`** 방식으로 확정(코드 변경 없음), `cap:sync` 스크립트 반영은 1-2에서.
  ✓기준: `npx vite build --mode app` 후 번들에서 추출한 키가 앱 전용 키이고, 모드 없는 빌드는 웹 키 유지.

---

## Phase 1. Capacitor 셸 구축

- [x] **1-1. Capacitor 설치 + 프로젝트 초기화**
  `@capacitor/core@7`, `@capacitor/cli@7`, `@capacitor/android@7` 설치(버전은 설치 시점에 `npm view`로 확인). 루트에 `capacitor.config.ts` 작성: `appId: 'cloud.triptyche.app'`, `appName: '트립티케'`, `webDir: 'dist'`, `server.androidScheme: 'https'`.
  ✓기준: `npx cap doctor` 통과.

- [x] **1-2. Android 프로젝트 생성 + 빌드 스크립트**
  `npx cap add android`로 `android/` 생성. `package.json`에 `cap:sync`(`vite build && cap sync`), `cap:android`(`cap:sync && cap open android`) 스크립트 추가. `android/` 커밋 대상 확인(.gitignore 조정 — 생성물 중 build 산출물만 제외).
  ✓기준: `npm run cap:sync` 성공, Android Studio에서 프로젝트 열림.

- [x] **1-3. 플랫폼 분기 구조 + 웹 회귀 방지**
  `src/platform/index.ts` 신설: `isNative()`/`isAndroid()` 헬퍼(`Capacitor.isNativePlatform()` 래핑). `src/shared/hooks/useBrowserCheck.ts`에 `isNative()` 가드 추가(앱에서 Android UA 경고 모달 미발화).
  ✓기준: 웹 빌드 동작 변화 없음 + 에뮬레이터에서 경고 모달 안 뜸.

- [x] **1-4. 에뮬레이터 첫 구동 확인**
  `npx cap run android`로 앱 로드. 로그인 없이 접근 가능한 화면(온보딩/로그인)과 3D 지구본 렌더 확인.
  ✓기준: 웹 자산이 WebView에서 로드되고 주요 화면이 렌더됨. (API 호출은 CORS로 실패할 수 있음 — 1-5에서 처리)

- [x] **1-5. 개발 단계 API 연결 결정: CapacitorHttp 활성화**
  Phase 6(BE CORS 수정) 전까지 앱에서 API를 검증하기 위해 `capacitor.config.ts`에 `plugins.CapacitorHttp.enabled: true`(네이티브 HTTP — CORS 미적용) 설정, axios 동작 확인.
  ✓기준: 에뮬레이터에서 비인증 API(예: 게스트 발급) 응답 수신. ⚠️ STOMP WebSocket은 우회 불가 — 실시간 알림은 Phase 6 후 검증. 정식 해법은 6-1 CORS이며 이 항목은 개발 편의용.

- [x] **1-6. 앱 셸 UX: 상태바·스플래시·백버튼·외부링크**
  `@capacitor/status-bar`·`@capacitor/splash-screen` 설정, `@capacitor/app`의 `backButton` 리스너 → react-router history 연동(루트에서는 앱 종료), 외부 링크는 `@capacitor/browser`로 열기. 담당 모듈 `src/platform/native/appShell.ts` 신설.
  ✓기준: 하드웨어 백버튼이 화면 스택을 따라 동작, 외부 링크가 WebView를 이탈시키지 않음.


---

## Phase 2. 갤러리 피커 + EXIF GPS 보존 — ★ 앱을 만드는 이유

- [x] **2-1. 네이티브 파일 피커 도입** — `src/platform/native/gallery.ts` 신설
  `@capawesome/capacitor-file-picker` 설치, 다중 이미지 선택 → `File[]` 변환 래퍼 작성. ⚠️ `@capacitor/camera`는 EXIF GPS를 제거하므로 사용 금지.
  ✓기준: 앱에서 갤러리 다중 선택 → File 객체로 기존 타입과 호환.

- [x] **2-2. `ACCESS_MEDIA_LOCATION` 권한 연동**
  `android/app/src/main/AndroidManifest.xml`에 권한 선언 + 사진 선택 전 런타임 요청 흐름(거부 시 안내 후 진행). `gallery.ts`에 권한 체크 포함.
  ✓기준: 권한 허용 상태에서 선택한 사진의 EXIF에 GPS가 남아 있음(로그로 확인).

- [x] **2-3. 업로드 진입점 분기 연결**
  `src/pages/trip/management/TripImageUploadPage.tsx`(및 `usePhotoUpload`/`useImageUpload` 진입부)에서 `isNative()`면 `gallery.ts` 피커, 웹이면 기존 `<input type="file">`. 이후 파이프라인(HEIC 변환 → EXIF 추출 → presigned 업로드)은 **기존 코드 그대로 재사용**.
  ✓기준: 앱·웹 양쪽에서 선택→메타데이터 추출까지 동일하게 진행.

- [ ] **2-4. 권한 거부 폴백 확인**
  권한 거부/GPS 없는 사진 → 기존 "위치 미지정" 플로우(`NoLocationResolvePage`, `MapPickPage`)로 자연 진입하는지 확인. 필요 시 안내 문구만 보강.
  ✓기준: 권한 거부 상태에서 업로드해도 기능이 깨지지 않고 수동 지정으로 이어짐.

- [ ] **2-5. ★핵심 마일스톤: 실기기 EXIF 보존 검증**
  실제 Android 기기에서 GPS 포함 사진 선택 → lat/lng·**촬영시각**(0-2 수정분) 추출값 확인.
  **HEIC 1장을 반드시 테스트 케이스에 포함** — 현재 파이프라인은 EXIF 추출 **전에** heic2any 변환을 돌리므로 HEIC는 GPS를 잃을 수 있다(안드로이드 기본 JPEG은 변환을 거치지 않아 무관하나, 삼성 HEIF 옵션·공유받은 아이폰 사진이 해당). 손실이 확인되면 별도 작업으로 분리 — 배경은 [`phase-0-cleanup/README.md` 추가 발견 A](phase-0-cleanup/README.md#a-heic-사진의-exif-손실-가능성) 참조.
  ✓기준: 웹에서 GPS가 지워지던 동일 사진이 앱에서는 좌표가 추출됨. **이게 통과되면 앱 프로젝트의 존재 이유가 실증된 것.** (S3 업로드까지의 최종 확인은 Phase 6 후 E2E)

---

## Phase 3. 인증 — FE 단독 가능분 먼저

- [x] **3-1. 토큰 저장소** — `src/platform/native/auth.ts` 신설
  `@capacitor/preferences`로 access/refresh 저장·로드·삭제 유틸.
  ✓기준: 저장→앱 재시작→로드 왕복 동작.

- [x] **3-2. API 클라이언트 Bearer 분기** — `src/libs/apis/shared/client.ts`, `interceptors.ts`
  `isNative()`면 `withCredentials` 대신 저장 토큰을 `Authorization: Bearer`로 주입, 401 시 토큰 폐기→로그인 화면(리프레시 연동은 [BE 의존] — 현행 `/v1/auth/refresh`는 쿠키 전용).
  ✓기준: 웹 쿠키 흐름 회귀 없음 + 앱에서 Bearer 헤더 첨부 확인.

- [x] **3-3. 게스트 로그인으로 Bearer 경로 검증 (백엔드 무변경)**
  기존 `POST /v1/auth/guest`가 body로 토큰을 반환하고 백엔드 `JWTAuthenticationFilter`가 Bearer를 이미 수용하므로, **게스트 모드로 앱의 토큰 인증 전체 경로를 지금 검증할 수 있다.**
  ✓기준: 앱에서 게스트 시작 → 보호 API(여행 목록 등) 정상 호출 → 재시작 후 세션 유지(4h 만료 내).

- [ ] **3-4. 소셜 로그인 골격: 인앱 브라우저 + 딥링크 수신** `[BE 의존]`
  `@capacitor/browser`로 OAuth URL 오픈하는 `SigninPage.tsx` `isNative()` 분기, `AndroidManifest.xml`에 `triptyche://` intent-filter, `@capacitor/app` `appUrlOpen` 리스너에서 one-time code 파싱→교환 호출 골격(`auth.ts`).
  ✓기준: `adb shell am start -a android.intent.action.VIEW -d "triptyche://auth/callback?code=test"`로 딥링크가 앱에 수신되고 파서까지 도달. 실제 카카오/구글 E2E는 Phase 6-2 후.

---

## Phase 4. 푸시 — FE 단독 가능분 먼저

- [ ] **4-1. Firebase 프로젝트 + Android 앱 등록**
  Firebase 프로젝트 생성, 패키지명 `cloud.triptyche.app` 등록, `google-services.json`을 `android/app/`에 배치(비밀 관리 방침 결정: 커밋 여부).
  ✓기준: 앱 빌드에 google-services 플러그인 적용되어 빌드 성공.

- [ ] **4-2. FCM 플러그인 통합 + 권한** — `src/platform/native/push.ts` 신설
  `@capacitor-firebase/messaging` 설치, 앱 시작 시 알림 권한 요청(거부 시 graceful degrade — 기능 차단 없음), FCM 토큰 획득·로그.
  ✓기준: 에뮬레이터/실기기에서 FCM 토큰이 로그에 찍힘.

- [ ] **4-3. 토큰 등록 훅 골격** `[BE 의존]` — `src/domains/notification/hooks/usePushRegistration.ts` 신설
  로그인 후 `POST /v1/devices { token, platform: 'android', appVersion }` 호출 골격 작성(엔드포인트는 Phase 6-3에서 생김 — 그때까지 no-op/플래그 처리).
  ✓기준: 코드 리뷰 수준 완료 + 백엔드 미존재 시 에러 없이 스킵.

- [ ] **4-4. 수신 핸들러: 포그라운드 배너 + 탭 딥링크 라우팅**
  포그라운드 수신 → 기존 배너 UI(`src/domains/notification/banner`) 연결, 백그라운드/종료 상태에서 알림 탭 → payload `data.deeplink`(`triptyche://trip/{tripKey}`)로 라우팅.
  ✓기준: **Firebase 콘솔 테스트 메시지**(4-2의 토큰 대상)로 포그라운드 배너·백그라운드 알림 탭 진입까지 백엔드 없이 검증. 실서비스 이벤트 발송 검증은 Phase 6-3 후.

---

## Phase 5. 마감 / 스토어 준비

- [ ] **5-1. WebGL 실기기 성능 측정·튜닝**
  저사양 포함 실기기에서 3D 지구본(`GlobeMapPage`)·드론뷰(`CinematicDroneMap`) 프레임 측정. 필요 시 DPR 상한 하향·antialias 조정·파티클 LOD, 저사양 폴백 모드 도입 여부 결정.
  ✓기준: 저사양 기준 기기에서 지구본 조작이 실사용 가능한 프레임 유지.

- [ ] **5-2. 스토어 빌드에서 DEV 로그인 제거**
  DEV 로그인 버튼(SigninPage Step 2)이 프로덕션/스토어 빌드에 포함되지 않도록 빌드 분기.
  ✓기준: release 빌드에서 DEV 로그인 미노출, 로컬 dev에선 유지.

- [ ] **5-3. 앱 아이콘 · 스플래시 스토어 규격 생성**
  기존 `public/icon-*.png` 기반으로 Android 다해상도(adaptive icon 포함)·스플래시 자산 생성, `android/` 리소스 반영.
  ✓기준: 런처 아이콘·스플래시가 실기기에서 정상 표시.

- [ ] **5-4. 권한 문구 · 개인정보 처리방침**
  매니페스트 권한 최소화 점검(`ACCESS_MEDIA_LOCATION`, 알림), Play Console 데이터 안전 섹션 답변 준비, 개인정보 처리방침 URL 준비.
  ✓기준: Play Console 앱 콘텐츠 섹션 제출 가능 상태.

- [ ] **5-5. 서명 키 + Play 내부 테스트 트랙 업로드**
  업로드 키스토어 생성·보관 방침, AAB 빌드, Play Console 내부 테스트 트랙 업로드.
  ✓기준: 내부 테스터 기기에서 스토어 경유 설치 성공. (최종 기능 E2E는 Phase 6 완료 후)

---

## Phase 6. **[추후 실행] Backend** — FE 작업 완료 후 착수

> 상세 스펙: `backend-prd-app-release.md`. 대상 repo: `triptyche-backend`.

- [ ] **6-1. CORS 앱 origin 허용 (2곳 + 외부화)**
  `SecurityConfig.corsConfigurationSource()`와 `WebSocketConfig.registerStompEndpoints()` **양쪽**에 `https://localhost`(androidScheme https 기준) 추가, origin 목록 application.yml 외부화.
  ✓기준: 앱에서 CapacitorHttp 없이(1-5 원복) REST + STOMP 정상. S3 presigned PUT의 버킷 CORS도 함께 확인.

- [ ] **6-2. M1: 토큰 인증 + OAuth 딥링크 콜백**
  OAuth 콜백 앱 분기 → `triptyche://auth/callback`으로 **one-time code** 302, `POST /v1/auth/token/exchange`(code→토큰), `POST /v1/auth/token/refresh`(body 기반), redirect_uri 화이트리스트, refresh 회전·무효화. (Bearer 수용은 기존 `JWTAuthenticationFilter`로 이미 충족)
  ✓기준: 앱에서 카카오/구글 로그인 → 딥링크 복귀 → 토큰 교환 → 보호 API 호출 → 재시작 세션 유지.

- [ ] **6-3. M2: 디바이스 등록 + FCM 발송**
  `device` 테이블(user 1:N), `POST /v1/devices`(upsert)/`DELETE /v1/devices/{token}`, Firebase Admin SDK 통합(서비스 계정 비밀 관리), 기존 알림 이벤트(`SHARED_*`, `TRIP_*`, `MEDIA_*`) 발생 지점에 푸시 발송 추가, 무효 토큰 자동 정리, payload 규격(`data.type/deeplink/resourceId`) FE와 합의.
  ✓기준: 앱 종료 상태에서 공유 요청 발생 → 실기기에 푸시 도착 → 탭 시 해당 화면 진입.

- [ ] **6-4. (앱 무관 보안 — 조기 수정 권장) STOMP 구독 가드**
  `StompTopicAuthInterceptor`가 `/topic/media-processed/{userId}`만 보호 중 → `/topic/share-notifications/{recipientId}`에도 cross-user 구독 차단 추가.
  ✓기준: 타 유저 recipientId 구독 시도 시 거부.

- [ ] **6-5. (P1) 앱 운영 부수 작업**
  `X-Client`/`X-App-Version` 헤더 수용·로깅, `GET /v1/app/config`(minSupportedVersion — 강제 업데이트), 신규 엔드포인트 rate limit.
  ✓기준: 앱이 구버전 판정 시 업데이트 유도 화면 표시.

---

## 최종 E2E 검증 (Phase 6 완료 후)

- [ ] GPS 포함 사진(HEIC 포함) 선택 → EXIF 좌표·촬영시각 추출 → presigned S3 업로드 → 지도에 핀 자동 생성
- [ ] 권한 거부 상태에서 동일 플로우 → 위치 미지정 수동 지정으로 degrade
- [ ] 카카오/구글 로그인 → 인앱 브라우저 → 딥링크 복귀 → 앱 재시작 후 세션 유지
- [ ] 앱 종료 상태에서 알림 이벤트 → 푸시 도착 → 탭 시 딥링크 진입 / 포그라운드에서는 배너로 수신(중복 없음)
- [ ] 3D 지구본·Google Maps·드론뷰 프레임 확인(저사양 1대 포함)
- [ ] `vitest` 유닛 + Cypress(웹) 회귀 통과 — 웹 동작 무회귀 확인
- [ ] Play 내부 테스트 트랙 재업로드 → 테스터 설치 검증

---

## ★ Phase 2 실측 결과 — 프로젝트 전제를 뒤집는 발견

실기기(Android 16 / API 36)에서 GPS EXIF가 박힌 사진으로 검증한 결과다.

**결과: 촬영시각은 보존, GPS는 제거됨.**

| 항목 | 사진에 넣은 값 | 서버에 저장된 값 |
|---|---|---|
| 촬영시각 | `2023:07:04 15:20:30` | `2023-07-04T15:20:30` ✅ |
| 저장시각(교란용) | `2026:01:01 00:00:00` | (사용 안 됨 — 0-2 수정 정상 동작) |
| 위도/경도 | 37.5665 / 126.9780 | **0.0 / 0.0** ❌ |

`ACCESS_MEDIA_LOCATION` 권한은 `granted=true`로 확인했는데도 좌표만 사라졌다.

**원인**: 플러그인의 `pickImages()`는 `ACTION_GET_CONTENT`에 이미지 전용 타입을 실어 보내는데, Android 13+는 이를 **시스템 Photo Picker로 리다이렉트**한다. Photo Picker는 프라이버시 설계상 `ACCESS_MEDIA_LOCATION` 권한을 **무시하고 위치를 무조건 제거**한다. 플러그인 소스에도 `MediaStore.setRequireOriginal()` 호출이 없다.

즉 "네이티브 앱이면 ACCESS_MEDIA_LOCATION으로 GPS를 얻는다"는 기획 단계의 전제가 **Photo Picker 경로에서는 성립하지 않는다.**

**적용한 해결책(실측 미완)**: `pickFiles()`로 전환했다. 이쪽은 타입을 와일드카드로 보내 Photo Picker 리다이렉트를 피하고 SAF 문서 피커를 띄우며, documents provider는 이미지를 문서로 취급해 위치 메타데이터를 유지한다. 대신 UI가 갤러리 격자가 아닌 파일 브라우저다.

- [ ] **★ pickFiles 경로로 GPS가 실제 보존되는지 실측** — 이게 실패하면 커스텀 네이티브 플러그인(MediaStore 쿼리 + `setRequireOriginal()`)이 필요하다. 검증용 사진은 에뮬레이터 `/sdcard/Pictures/gps-test.jpg`에 있다.

**부수 확인**: Maps 앱 키의 referrer 제한이 WebView에서 실제로 `RefererNotAllowedMapError`를 냈다(Phase 0-4에서 예고한 사안). 제한을 풀고 쿼터·예산 알림으로만 통제하는 쪽으로 전환이 필요하다.

---

## Phase 1 진행 중 발견 (후속 처리 필요)

- **SigninPage 내부 step과 하드웨어 백버튼 미연동** — 로그인 화면은 별도 라우트가 아니라 같은 라우트의 Step 2라 히스토리가 쌓이지 않는다. Step 2에서 백버튼을 누르면 Step 1로 가지 않고 앱이 종료된다(화면 자체 ‹ 버튼은 정상 동작). 라우터 레벨 백버튼은 의도대로 작동하므로, 스텝을 가진 화면이 자체 핸들러를 등록하는 방식으로 해결한다.
- **⚠️ Phase 2-4/2-5가 Phase 3에 막혀 있음** — 앱에서 업로드 화면까지 도달하려면 로그인 세션이 필요한데, 아래 사유로 인증이 유지되지 않는다. 실기기 EXIF 검증(2-5)은 **Phase 3-1/3-2(토큰 저장 + Bearer 주입) 완료 후** 수행한다. 검증용 GPS 사진은 에뮬레이터 `/sdcard/Pictures/gps-test.jpg`에 넣어 두었다(촬영시각 2023-07-04, 저장시각 2026-01-01로 달라 0-2 수정도 함께 확인 가능).
- **게스트 로그인 세션이 WebView에서 유지되지 않음** — `POST /v1/auth/guest`는 200을 반환하지만 이후 온보딩으로 되돌아간다. 쿠키 기반 세션이 WebView에 남지 않기 때문으로, Phase 3-1/3-2(토큰 저장 + Bearer 주입)에서 해결된다. Phase 1 범위의 결함은 아니다.
- **DEV 로그인이 앱에서 동작하지 않던 문제 (수정함)** — API 주소를 `http://localhost:8080`으로 하드코딩해 에뮬레이터에서는 기기 자신을 가리켰고, 세션도 `document.cookie`로 심어 WebView에서 유지되지 않았다. `API_BASE_URL` 사용 + 네이티브에서는 토큰 저장소를 쓰도록 고쳤다.
- **`useUserStore.login(undefined)` 방어 부재** — 사용자 정보 조회가 실패하면 `userInfo.role`에서 `Cannot read properties of undefined`가 나고 앱이 로딩 화면에 멈춘다. 프로덕션 빌드에서는 API가 성공해 드러나지 않았으나, dev 서버 모드에서 재현된다. Phase 2-5 검증을 위해 dev 모드를 쓰려면 선행 수정이 필요하다.
