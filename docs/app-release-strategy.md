# 트립티케 모바일 앱 출시 전략 — 네이티브 vs Capacitor

> 작성일: 2026-06-07 · 대상: iOS / Android 스토어 출시
> 결론: **Capacitor 채택 + 같은 레포 단일 코드베이스 유지**

---

## 1. 배경 (Why)

트립티케를 iOS/Android **스토어 앱**으로 출시한다. 핵심 의사결정은
"네이티브(React Native/Flutter) 재작성" vs "Capacitor로 기존 웹 래핑"이다.

### 현재 앱 기술 프로필 (코드베이스 분석 결과)

| 영역 | 현황 | 모바일 전환 관점 |
|------|------|----------------|
| 프레임워크 | React 18.3 + Vite 5.4 + TypeScript (순수 SPA/CSR) | WebView 구동에 이상적 |
| UI | Mantine 7 + Emotion (CSS-in-JS) | **웹 전용** — RN 비호환 |
| 지도/3D | Google Maps JS + Deck.gl + Three.js | **WebGL/DOM 전용** — RN 재구현 필요 |
| 시그니처 기능 | 3D 지구본, Deck.gl 경로 오버레이, Cinematic 드론뷰 | 앱의 핵심 가치, 전부 웹 기술 |
| 상태/통신 | Zustand, TanStack Query, Axios, STOMP WebSocket | 플랫폼 무관 (재사용 가능) |
| 이미지 | EXIF 추출(piexifjs), HEIC 변환(heic2any), 압축 | 갤러리 파일 기반 (실시간 카메라 X) |
| 위치 | 사진 EXIF GPS 추출 | **실시간 GPS 권한 불필요** |
| 인증 | 쿠키 기반 OAuth (카카오/구글) | 모바일용 토큰 방식 전환 필요 |
| 푸시 | WebSocket 배너 (포그라운드 한정) | 네이티브 푸시(FCM/APNs) 추가 필요 |

**핵심 통찰**: 이 앱은 *"WebGL 시각화가 핵심 가치이면서 네이티브 하드웨어
의존도는 낮은"* 프로필이다. 가장 비싼 자산(3D 지도)이 웹에 묶여 있고,
정작 네이티브가 강점인 영역(카메라/센서/고성능 네이티브 UI)은 거의 쓰지 않는다.

---

## 2. 선택지 비교

### 2.1 종합 비교표

| 기준 | **Capacitor (✅ 채택)** | React Native / Expo | Flutter |
|------|------------------------|---------------------|---------|
| 3D 지구본·Deck.gl·드론뷰 | WebView에서 **그대로 동작** | 전면 재구현 (expo-gl/three, react-native-maps는 Deck.gl 미지원) | 전면 재구현 |
| UI(Mantine/Emotion) | **100% 재사용** | 전면 재작성 | 전면 재작성 (Dart) |
| 코드 재사용률 | **~95%+** | ~30~40% (api/store/유틸만) | ~0% (언어 다름) |
| 출시까지 기간 | **수 주** | 수 개월 | 수 개월~ |
| 웹+앱 단일 코드베이스 | **유지** | 분리(이중 유지보수) | 분리 |
| 런타임 성능(일반 UI) | WebView (충분) | 네이티브 (우수) | 네이티브 (우수) |
| WebGL 지도 성능 | WebView WebGL (실기기 검증 필요) | 별도 네이티브 GL 작업 필요 | 별도 작업 필요 |
| 네이티브 기능(푸시/갤러리/딥링크) | 플러그인으로 해결 | 기본 제공 | 기본 제공 |
| 팀 학습비용 | 낮음 (기존 React 그대로) | 중간 | 높음 (Dart) |
| **본 앱 적합성** | **최적** | 부적합 | 부적합 |

### 2.2 왜 네이티브 재작성이 부적합한가

- 앱의 **시그니처 가치 = WebGL 시각화**인데, 이것이 가장 재구현하기 어려운
  부분이다. react-native-maps는 Deck.gl 오버레이/Cinematic 드론뷰를 지원하지
  않아, 지도 경험 전체를 네이티브 GL로 새로 만들어야 한다.
- "코드 재사용 70~80%"라는 통념은 비즈니스 로직 기준이며, **본 앱은 시각화
  레이어가 비용의 대부분**이라 실제 재사용률이 30~40%로 떨어진다.
- 웹/앱 코드가 갈라져 **이중 유지보수**가 발생한다. 신규 기능마다 두 번 구현.

### 2.3 왜 Capacitor가 최적인가

- 기존 Vite 빌드(`dist/`)를 **WkWebView/Android WebView에 그대로 탑재**.
  Three.js·Deck.gl·Google Maps JS 모두 WebView WebGL에서 동작.
- 네이티브가 꼭 필요한 부분(푸시·인증 딥링크·갤러리·스플래시)만 **플러그인**
  으로 보강.
- React/Vite/TS 기존 역량을 그대로 활용, 학습비용 최소.

---

## 3. 레포 구조 결정 — 별도 앱 레포를 만들지 않는다

**검토 질문**: "앱 전용 프론트를 따로 두는 게 관리에 편하지 않나?"
**결론**: 이 앱에서는 **분리가 오히려 관리 부담을 키운다.**

### 3.1 분리(별도 레포/프론트)의 함정

- 핵심 자산(3D 지구본·Deck.gl·드론뷰·Mantine UI)을 **중복 보유하거나 재구현**
  해야 함 → 자산 가치 훼손.
- 이후 모든 기능을 **웹/앱 양쪽에 이중 포팅** → 시간이 갈수록 drift(불일치),
  버그 2배, "앱에선 왜 안 되지?"가 반복.

### 3.2 채택안: 같은 레포 + 플랫폼 분기

- 단일 레포에서 `Capacitor.isNativePlatform()` 분기 + `src/platform/` 폴더로
  **네이티브 전용 코드만 격리**. 양이 적어 한눈에 관리되고, 신규 기능은 웹·앱에
  **자동 동시 반영**.
- 원하던 "웹용/앱용 분리"의 실익(독립 배포·릴리스 주기)은 **빌드·배포
  파이프라인에서 이미 분리**되므로 코드 중복 없이 달성:

| | 소스 | 빌드 | 배포 |
|---|---|---|---|
| 웹 | 공통 `src/` | `vite build` | Vercel (기존 유지) |
| 앱 | 공통 `src/` | `vite build` → `cap sync` | Xcode / Android Studio → 스토어 |

> **한 벌의 소스, 두 개의 배포.**

### 3.3 장래 확장 (옵션 B)

웹/앱 팀·릴리스 주기가 완전히 갈리는 시점이 오면 **모노레포(pnpm/Turborepo)
+ 공유 패키지**로 점진 전환 가능. 현 시점에선 과한 선행 추상화이므로 미도입.

---

## 4. 채택 버전 / 환경 요건 (2026-06 기준)

| 항목 | 권장 |
|------|------|
| Capacitor | **7.x** (최신 7.6.x) 우선 권장 — iOS 14+ 지원으로 기기 커버리지 넓음. 신규 시작이면 8.x(8.3.x, iOS 15+)도 가능 |
| Node | Cap 7 → 20+, Cap 8 → 22+ |
| iOS 최소 | Cap 7 → iOS 14.0, Cap 8 → iOS 15.0 |
| Android | Android Studio Ladybug(2024.2.1)+ / JDK 21 (Cap 7 기준) |

> 결정 포인트: 구형 iOS 기기 커버리지가 중요하면 **Capacitor 7**, 최신
> 기능/장기 지원 우선이면 **Capacitor 8**. 현 프로젝트는 7로 시작 권장.

---

## 5. 출시 범위 (사용자 확정 사항 반영)

- ✅ **네이티브 푸시 알림 = 출시 필수** → FCM/APNs 통합 포함 (백엔드 작업 동반)
- ✅ **쿠키 OAuth → 토큰 기반 전환 가능(권장)** → 모바일 인증 재설계 포함
- ✅ 단일 레포 + 플랫폼 분기 구조 채택

---

## 6. 리스크 & 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| WebView WebGL 성능 (저사양 Android) | 3D 지구본/Deck.gl 프레임 저하 | 실기기 프레임 검증, 디테일/파티클 조정, 필요 시 저사양 모드 |
| Apple 4.2 (최소 기능) 거절 | 순수 웹뷰 래퍼 반려 | 네이티브 푸시·갤러리·딥링크·스플래시로 네이티브 가치 충족 |
| Apple 4.8 (로그인) | 소셜 로그인 시 반려 | **Sign in with Apple** 동등 제공 추가 (iOS) |
| EXIF GPS 손실 | 위치 자동추출 기능 붕괴 | Camera 플러그인 대신 File Picker + `ACCESS_MEDIA_LOCATION` 권한 |
| WebView 쿠키/세션 불안정 | 로그인 풀림 | 토큰 기반(@capacitor/preferences) 전환 |

---

## 7. 관련 문서

- `docs/app-frontend-tasks.md` — 프론트 구체 작업·필요 라이브러리·작업 분류
- `docs/backend-prd-app-release.md` — 백엔드 수정요소 PRD

---

## 부록: 출처 (2026-06 검색)

- [Capacitor 공식 — React 솔루션](https://capacitorjs.com/solution/react)
- [Capacitor + React 가이드 (2026)](https://noqta.tn/en/tutorials/capacitor-react-mobile-app-ios-android-2026)
- [Updating to Capacitor 7.0](https://capacitorjs.com/docs/updating/7-0)
- [Updating to Capacitor 8.0](https://capacitorjs.com/docs/updating/8-0)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple, Sign in with Apple 요건 완화 보도 (9to5Mac, 2024)](https://9to5mac.com/2024/01/27/sign-in-with-apple-rules-app-store/)
