# 트립티케 App 프론트엔드 구체 작업 명세

> 작성일: 2026-06-07 · 전제: Capacitor 채택, 같은 레포 + `src/platform/` 분기
> 대상 독자: FE 개발자 (실행 가능한 수준의 구체 명세)

---

## 0. 개요

기존 Vite/React 코드를 그대로 두고, Capacitor 셸 + 네이티브 전용 모듈을 더한다.
모든 네이티브 전용 로직은 `src/platform/native/`에 격리하고, `Capacitor.isNativePlatform()`
분기로 웹과 공존시킨다.

```
src/
├── platform/
│   ├── index.ts            # isNative(), isIOS(), isAndroid() 등 분기 헬퍼
│   ├── native/
│   │   ├── auth.ts         # OAuth 딥링크 + 토큰 저장
│   │   ├── push.ts         # FCM/APNs 등록·수신
│   │   ├── gallery.ts      # 네이티브 파일 픽커 (EXIF 보존)
│   │   └── appShell.ts     # 스플래시/상태바/백버튼/딥링크 라우팅
│   └── web/                # 웹 전용 대체 구현 (필요 시)
capacitor.config.ts          # 루트
ios/  android/               # 네이티브 프로젝트 (cap add 생성물)
```

---

## 1. 필요 라이브러리 (2026-06 현 시점 기준)

> 버전은 설치 시점에 `npm view <pkg> version`으로 최종 확인할 것. 아래는 현 시점
> 메이저/권장 라인.

### 1.1 Capacitor 코어 (필수)

| 패키지 | 용도 | 비고 |
|--------|------|------|
| `@capacitor/core` | 런타임 | **v7.x** 권장 (iOS14+), 신규면 v8 가능 |
| `@capacitor/cli` | CLI (init/add/sync) | 코어와 메이저 일치 |
| `@capacitor/ios` | iOS 네이티브 프로젝트 | |
| `@capacitor/android` | Android 네이티브 프로젝트 | |

### 1.2 인증 (쿠키 → 토큰 전환)

| 패키지 | 용도 | 선택 근거 |
|--------|------|----------|
| `@capacitor/browser` | 인앱 브라우저(ASWebAuthenticationSession / Chrome Custom Tabs)로 OAuth 진행 | 스토어 친화 + UX |
| `@capacitor/app` | 딥링크(`appUrlOpen`) 수신 | OAuth 콜백 토큰 회수 |
| `@capacitor/preferences` | 토큰 저장 (소형 KV) | 쿠키 대체 |
| `capacitor-kakao-login-plugin` (nerdFrenzs) | 카카오 **네이티브 SDK** 로그인 (Android/iOS/Web) | 카카오톡 앱 연동 로그인. *UX 최상안, 2차 적용 가능* |
| `@capgo/capacitor-social-login` | 구글/애플 통합 소셜 로그인 (PKCE) | Sign in with Apple 동시 충족에 유리 |

> **권장 전략**: 1차는 `@capacitor/browser` + 딥링크로 기존 백엔드 OAuth
> 엔드포인트 재활용(빠른 출시). 2차에서 카카오/구글 **네이티브 SDK**로 UX 고도화.
> OAuth2 직접 구현 시 **Authorization Code Flow + PKCE** 필수.

### 1.3 푸시 알림 (출시 필수)

| 패키지 | 용도 | 비고 |
|--------|------|------|
| `@capacitor-firebase/messaging` | **FCM/APNs 통합 토큰** 수신 (권장) | iOS도 FCM 토큰으로 일원화 (네이티브 APNs 토큰 변환 이슈 회피) |
| `firebase` | Firebase JS SDK 의존 | 위 플러그인 동반 |
| (대안) `@capacitor/push-notifications` | 기본 푸시 플러그인 | iOS에서 APNs↔FCM 토큰 불일치 핸들링 필요 → 통합 플러그인 권장 |

> iOS는 **APNs 인증키(.p8)** 방식 사용(인증서 대신). Firebase Console >
> Cloud Messaging에 .p8 업로드. Podfile platform 15.0+.

### 1.4 이미지/갤러리 (EXIF GPS 보존이 핵심)

| 패키지 | 용도 | 주의 |
|--------|------|------|
| `@capawesome/capacitor-file-picker` | 갤러리에서 **원본 파일** 선택 (다중) | EXIF 보존 위해 Android에 `ACCESS_MEDIA_LOCATION` 권한 필요 |
| (비권장) `@capacitor/camera` | 카메라/갤러리 | **EXIF(특히 GPS) 제거됨** → 본 앱 핵심 기능과 충돌, 회피 |

> 기존 `heic2any`/`browser-image-compression`/`piexifjs`는 **그대로 유지**.
> File Picker로 받은 원본 Blob에 기존 EXIF 추출 파이프라인 연결.

### 1.5 앱 셸 / UX

| 패키지 | 용도 |
|--------|------|
| `@capacitor/splash-screen` | 스플래시 |
| `@capacitor/status-bar` | 상태바 스타일/세이프에어리어 |
| `@capacitor/app` | 백버튼, 앱 상태, 딥링크 |
| `@capacitor/keyboard` | 키보드 리사이즈 처리 (폼 화면) |
| (옵션) `@capacitor/share` | 여행 공유 네이티브 시트 |
| (옵션) `@capacitor/network` | 온/오프라인 감지 (현재 `window.online` 대체 가능) |

### 1.6 OTA 업데이트 (선택, 운영 효율)

| 패키지 | 용도 |
|--------|------|
| (옵션) `@capgo/capacitor-updater` | 스토어 심사 없이 JS 번들 OTA 배포 (웹 자산 갱신) |

---

## 2. 구현 방향

### 2.1 빌드/배포 파이프라인

```jsonc
// package.json scripts (추가)
{
  "build": "vite build",                  // 웹 (기존)
  "cap:sync": "vite build && cap sync",   // 앱 자산 동기화
  "cap:ios": "npm run cap:sync && cap open ios",
  "cap:android": "npm run cap:sync && cap open android"
}
```

- `capacitor.config.ts`: `webDir: 'dist'`, `appId: 'cloud.triptyche.app'`,
  `appName: '트립티케'`, iOS/Android scheme, `server.androidScheme: 'https'`.
- 환경변수(`VITE_*`)는 빌드 타임 주입 → 기존 방식 유지. 단, 앱/웹 분기가 필요한
  값(딥링크 redirect URI 등)은 `src/platform/index.ts`에서 분기.

### 2.2 인증 (쿠키 → 토큰)

흐름:
1. `SigninPage`에서 `isNative()`면 `@capacitor/browser`로 백엔드 OAuth URL
   (`{API}/oauth2/authorization/kakao|google`) 오픈.
2. 백엔드가 인증 후 커스텀 스킴 딥링크(`triptyche://auth?token=...&refresh=...`)로
   리다이렉트.
3. `@capacitor/app`의 `appUrlOpen` 리스너가 토큰 파싱 → `@capacitor/preferences`
   저장 → 인앱 브라우저 닫기 → 인증 상태 갱신.
4. Axios 인터셉터가 저장된 토큰을 `Authorization: Bearer`로 주입.

수정 대상 파일:
- `src/libs/apis/shared/client.ts` — 앱: `withCredentials` 대신 Bearer 헤더
- `src/libs/apis/shared/interceptors.ts` — 401 시 토큰 리프레시 로직 (앱)
- `src/pages/SigninPage.tsx` — `isNative()` 분기 + Browser/딥링크
- `src/domains/user/stores/useUserStore.ts` — 토큰/세션 상태
- 신규 `src/platform/native/auth.ts` — 딥링크 핸들러, 토큰 저장/로드
- iOS `Info.plist` URL Scheme, Android `intent-filter` 등록

> 웹은 기존 쿠키 흐름 유지 → `isNative()` 분기로 공존.

### 2.3 푸시 알림

- 앱 시작 시 `src/platform/native/push.ts`에서:
  1. 권한 요청 → 거부 시 graceful degrade
  2. FCM 토큰 획득 → 백엔드 `POST /v1/devices` 등록 (userId, token, platform)
  3. 포그라운드 수신 → 기존 배너 UI(`src/domains/notification/banner`) 연결
  4. 알림 탭(백그라운드/종료) → payload의 딥링크로 해당 화면 라우팅
- 기존 STOMP(`src/libs/socket.ts`)는 **포그라운드 실시간용 유지**, 푸시는
  백그라운드/종료 보완 → 이중 채널.
- 신규 훅: `src/domains/notification/hooks/usePushRegistration.ts`

### 2.4 갤러리/이미지 + EXIF

- `isNative()`면 `@capawesome/capacitor-file-picker`로 다중 선택 → 원본 Blob 확보.
- 기존 파이프라인 재사용: HEIC 변환(`image.ts`) → EXIF GPS/날짜 추출(`exif.ts`)
  → 압축 → presigned URL → S3 업로드(`useImageUpload.ts`).
- Android: `ACCESS_MEDIA_LOCATION` 권한 추가(매니페스트 + 런타임 요청), 미허용
  시 GPS 누락 → 기존 "위치 미지정 처리" 플로우로 자연 폴백.
- iOS: 사진 라이브러리 권한(`NSPhotoLibraryUsageDescription`) 문구.

수정 대상:
- `src/pages/trip/management/TripImageUploadPage.tsx`
- `src/domains/media/hooks/useImageUpload.ts`
- `src/libs/utils/image.ts`, `src/libs/utils/exif.ts`
- 신규 `src/platform/native/gallery.ts`

### 2.5 앱 셸 / 네이티브 UX

- 스플래시/상태바 설정, 세이프에어리어(`env(safe-area-inset-*)`) 점검
  (이미 `viewport-fit=cover` 적용됨).
- Android 하드웨어 백버튼: `App.addListener('backButton')` → 라우터 history 연동.
- 외부 링크는 시스템 브라우저로(`@capacitor/browser`), WebView 이탈 방지.
- 앱 아이콘/스플래시 자산: 기존 `public/icon-*.png`, `apple-touch-icon.png` 활용
  + 스토어 규격(다양한 해상도) 생성.

### 2.6 WebGL 성능 검증

- 실기기(저사양 Android 포함)에서 GlobeMapPage(Three.js) + Deck.gl 경로
  프레임레이트 측정. 필요 시 LOD/파티클/틸트 디테일 조정, 저사양 폴백 모드.

---

## 3. 작업 분류 (WBS)

### Epic A. Capacitor 기반 구축
- A1. Capacitor 설치/`cap init`/`capacitor.config.ts`
- A2. `cap add ios` / `cap add android`, 빌드 스크립트 연동
- A3. `src/platform/` 분기 구조 + `isNative/isIOS/isAndroid` 헬퍼
- A4. 앱 아이콘/스플래시/세이프에어리어/상태바

### Epic B. 인증 재설계 (토큰)
- B1. Axios 클라이언트/인터셉터 Bearer 토큰화 (앱 분기)
- B2. `@capacitor/browser` OAuth + 딥링크 콜백 핸들러
- B3. 토큰 저장/리프레시(`@capacitor/preferences`)
- B4. iOS URL Scheme / Android intent-filter 등록
- B5. (Apple 4.8) Sign in with Apple 추가 — iOS
- B6. (2차) 카카오/구글 네이티브 SDK 로그인 고도화

### Epic C. 푸시 알림 (출시 필수)
- C1. Firebase 프로젝트, `google-services.json`, APNs .p8
- C2. `@capacitor-firebase/messaging` 통합 + 권한/토큰 획득
- C3. 디바이스 토큰 백엔드 등록 훅
- C4. 포그라운드 배너 연결 + 알림 탭 딥링크 라우팅
- C5. 백엔드 푸시 발송 연동 검증 (→ backend PRD)

### Epic D. 갤러리/이미지 EXIF
- D1. File Picker 도입 + 다중 선택
- D2. EXIF 추출 파이프라인 연결 검증 (GPS/날짜)
- D3. Android `ACCESS_MEDIA_LOCATION` / iOS 사진 권한
- D4. HEIC/압축/업로드 회귀 테스트

### Epic E. 마감/심사
- E1. WebGL 실기기 성능 검증·튜닝
- E2. 권한 사용 설명 문구(Info.plist/매니페스트), 개인정보 처리방침
- E3. TestFlight / Play 내부 테스트 업로드, 심사 체크리스트
- E4. (옵션) `@capgo/capacitor-updater` OTA 구성

### 우선순위 / 의존성
- **출시 필수(MVP)**: A → B(B1~B5) → C → D → E
- **2차(고도화)**: B6(네이티브 SDK 로그인), E4(OTA)
- C(푸시)·B(인증)는 **백엔드 작업 의존** → `backend-prd-app-release.md` 동기화 필요

---

## 4. 검증 (E2E)

1. `npm run cap:sync` 후 `cap run ios`/`cap run android` 구동.
2. 3D 지구본·Google Maps·Deck.gl 오버레이·드론뷰 정상 + 프레임 확인(저사양 1대).
3. 카카오/구글 로그인 → 인앱 브라우저 → 딥링크 복귀 → 토큰 저장 → 재시작 세션 유지.
4. 갤러리 사진(GPS/날짜 포함, HEIC 포함) 선택 → EXIF 추출 → S3 업로드 성공.
5. 앱 종료 상태에서 공유요청/미디어처리 이벤트 → 네이티브 푸시 도착 → 탭 시 딥링크 진입.
6. `vitest` 유닛, Cypress(웹) 회귀 통과.
7. TestFlight/Play 내부 테스트 트랙 업로드.

---

## 부록: 출처 (2026-06 검색)

- [Capacitor + React 가이드 (2026)](https://noqta.tn/en/tutorials/capacitor-react-mobile-app-ios-android-2026)
- [Capacitor Push Notifications API](https://capacitorjs.com/docs/apis/push-notifications)
- [Push Notifications - Firebase (Capacitor Docs)](https://capacitorjs.com/docs/guides/push-notifications-firebase)
- [@capacitor-firebase/messaging (npm)](https://www.npmjs.com/package/@capacitor-firebase/messaging)
- [Capawesome — Push Notifications Guide](https://capawesome.io/blog/the-push-notifications-guide-for-capacitor/)
- [Capawesome — File Picker Plugin](https://capawesome.io/plugins/file-picker/)
- [@capgo/capacitor-social-login](https://github.com/Cap-go/capacitor-social-login)
- [capacitor-kakao-login-plugin](https://github.com/nerdFrenzs/capacitor-kakao-login-plugin)
- [5 Steps to Implement OAuth2 in Capacitor Apps](https://capgo.app/blog/5-steps-to-implement-oauth2-in-capacitor-apps/)
- [Updating to Capacitor 7.0](https://capacitorjs.com/docs/updating/7-0)
