# [PRD] 트립티케 앱 출시에 따른 Backend 수정요소

> 작성일: 2026-06-07 · 갱신일: 2026-08-22 · 작성자: FE → BE 협의용
> 전제: FE는 Capacitor 하이브리드 앱으로 출시. 단일 코드베이스.
> 범위(2026-08-22 확정): **Android 단독 선출시** — M3(Sign in with Apple)·APNs는 iOS 후속 단계로 이연.
> 실행 시점: **FE(Capacitor) 작업 완료 후 착수** — 순서는 `app-capacitor-checklist.md` Phase 6 참조.
> 본 문서는 **앱 출시를 위해 백엔드에서 신규/변경되어야 하는 요소**를 실무
> 관점으로 정리한다.

---

## 0. 요약 (TL;DR)

앱 출시를 위해 백엔드는 다음 3개 영역의 작업이 필요하다.

| # | 영역 | 핵심 작업 | 우선순위 |
|---|------|----------|---------|
| 1 | **인증** | 쿠키 → **토큰(Bearer)** 발급/리프레시 + OAuth 콜백 **딥링크** 리다이렉트 | P0 (출시 필수) |
| 2 | **푸시 알림** | 디바이스 토큰 등록 API + 기존 알림 이벤트의 **FCM 발송** (APNs는 iOS 후속) | P0 (출시 필수) |
| 3 | **앱 운영** | 클라이언트 식별/버전 정책, CORS·딥링크 도메인, 강제 업데이트 | P1 |

> 인증·푸시는 FE 단독으로 불가하며 **BE 동반 작업이 출시 차단요소(blocker)**.

---

## 1. 인증 — 쿠키 세션 → 토큰 기반 전환

### 1.1 배경 / 문제

- 현재: OAuth(카카오/구글) 성공 후 `access_token` **쿠키**(`withCredentials`)로
  세션 유지.
- 앱(WebView/인앱 브라우저) 환경에서는 쿠키 공유·영속성이 불안정하고,
  인앱 브라우저(ASWebAuthenticationSession/Custom Tabs)와 앱 WebView 간
  세션 쿠키가 단절된다. 스토어 심사/UX 측면에서도 토큰 방식이 표준.

### 1.2 요구사항

**(R1) OAuth 콜백을 딥링크로 토큰 반환**
- 기존 엔드포인트 `{API}/oauth2/authorization/{kakao|google}` 재사용.
- 인증 성공 후, **클라이언트 타입이 앱**인 경우 응답을 커스텀 스킴 딥링크로
  302 리다이렉트:
  ```
  triptyche://auth/callback?accessToken=<JWT>&refreshToken=<token>&expiresIn=<sec>
  ```
- 앱/웹 분기 방법(택1):
  - OAuth 시작 시 `state` 또는 쿼리(`?client=app&redirect_uri=triptyche://...`)
    전달 → 콜백에서 분기.
  - 또는 앱 전용 콜백 경로 분리(`/oauth2/.../app`).
- **보안**: redirect_uri **화이트리스트** 검증(임의 스킴 차단), 토큰은 1회용
  authorization code 교환 권장(딥링크 URL에 장기 토큰 직접 노출 최소화).
  - 권장 패턴: 딥링크로는 **단기 one-time code** 전달 → 앱이
    `POST /v1/auth/token/exchange`로 실제 토큰 교환 (URL 로깅 노출 위험 ↓).

**(R2) 토큰 발급·검증·리프레시**
- `access_token`(JWT, 단기) + `refresh_token`(장기) 발급.
- 신규/정비 엔드포인트:
  | 메서드 | 경로 | 설명 |
  |--------|------|------|
  | `POST` | `/v1/auth/token/exchange` | one-time code → 토큰 교환 (R1 권장 패턴) |
  | `POST` | `/v1/auth/token/refresh` | refresh → 새 access 발급 |
  | `POST` | `/v1/auth/logout` | refresh 무효화 (기존 보완) |
- **API 인증 방식**: 앱 요청은 `Authorization: Bearer <access_token>` 허용.
  → 기존 쿠키 인증과 **양립**(웹은 쿠키 유지) 하도록 Security 설정에서
  Bearer + Cookie 둘 다 수용.
  - ✅ **(2026-08-22 코드 확인) 이미 충족**: `JWTAuthenticationFilter`가
    `Authorization: Bearer` → `access_token` 쿠키 → `?token=` 쿼리 순으로 수용
    중이라 보호 API는 헤더 인증으로 현재도 동작한다. 남은 작업은 **토큰 "획득"
    경로**(R1/R2 엔드포인트)뿐. body로 토큰을 반환하는 기존 선례:
    `POST /v1/auth/guest`, `TestTokenController`.

**(R3) 게스트 로그인 유지**
- 기존 `POST /v1/auth/guest`도 토큰 방식으로 응답 일치시킴.

### 1.3 [iOS 후속] Sign in with Apple (Apple 4.8 대응)
- iOS 앱에서 소셜 로그인(카카오/구글) 제공 시, Apple 정책상 **프라이버시
  보장 대체 로그인(Sign in with Apple) 동등 제공**이 사실상 필요.
- BE: Apple OAuth(애플 ID 토큰 검증, 이메일 relay 처리) 추가, 사용자 계정
  연동(동일 유저 식별/병합) 정책 수립.

### 1.4 BE 작업 체크리스트
- [ ] OAuth 콜백 앱 분기 + 딥링크/one-time code 리다이렉트
- [ ] redirect_uri 화이트리스트 검증
- [ ] 토큰 발급/리프레시/교환 엔드포인트
- [ ] Security 설정: Bearer + Cookie 동시 수용
- [ ] refresh 토큰 저장/회전(rotation)·무효화
- [ ] [iOS 후속] Sign in with Apple 연동 (iOS 심사 대응)

---

## 2. 푸시 알림 — FCM/APNs 발송 (출시 필수)

### 2.1 배경 / 문제

- 현재 알림: **STOMP WebSocket 배너**로 포그라운드에서만 수신
  (`/topic/...`, `/user/{userId}/queue/request`).
- 앱이 백그라운드/종료 상태면 알림이 도달하지 않음 → "앱이 꺼져 있어도
  도착하는 진짜 푸시" 필요(출시 필수 확정).

### 2.2 요구사항

**(R4) 디바이스 토큰 등록/해제 API**
| 메서드 | 경로 | Body | 설명 |
|--------|------|------|------|
| `POST` | `/v1/devices` | `{ token, platform: "ios"\|"android", appVersion }` | 로그인 사용자에 FCM 토큰 등록(upsert) |
| `DELETE` | `/v1/devices/{token}` | — | 로그아웃/토큰 폐기 시 해제 |
- 한 사용자가 다기기 → 토큰 **다중 보관**(user 1 : N device).
- 토큰 갱신/만료 처리: FCM `UNREGISTERED`/`InvalidRegistration` 응답 시 자동 정리.

**(R5) 알림 이벤트의 푸시 발송**
- 기존 WebSocket으로 보내던 이벤트를 **푸시로도 발송**(이중 채널):
  - 공유: `SHARED_REQUEST`, `SHARED_APPROVE`
  - 여행/미디어: `TRIP_*`, `MEDIA_*` (예: 미디어 처리 완료)
- 발송 로직: 이벤트 발생 지점에서
  1. 온라인(WebSocket 세션 있음) → 기존 STOMP 배너
  2. **항상 또는 오프라인** → FCM/APNs 푸시 (정책 결정 필요, 아래 R6)
- **Firebase Admin SDK**(서버) 사용. [iOS 후속] iOS는 APNs .p8 키를 Firebase에
  등록하여 FCM 단일 채널로 발송.

**(R6) 중복/정책 결정 (협의 필요)**
- 포그라운드 WebSocket 수신 시 푸시 중복 방지: 푸시 payload에 `data` 동봉,
  앱이 포그라운드면 OS 알림 suppress(앱 내 배너로 대체).
- 사용자 알림 설정(on/off, 카테고리별) 필요 여부 → 설정 화면(`SettingPage`)
  연동 시 `GET/PUT /v1/users/me/notification-settings`.

**(R7) 푸시 payload 규격 (딥링크 라우팅)**
- 알림 탭 시 해당 화면으로 진입하도록 payload에 라우팅 정보 포함:
  ```json
  {
    "notification": { "title": "...", "body": "..." },
    "data": {
      "type": "SHARED_REQUEST",
      "deeplink": "triptyche://trip/{tripKey}",
      "resourceId": "..."
    }
  }
  ```

### 2.3 인프라
- Firebase 프로젝트 생성(또는 기존 활용), 서버에 Admin 자격증명(서비스 계정 키).
- [iOS 후속] APNs 인증키(.p8) 발급 → Firebase Cloud Messaging 등록.
- Android `google-services.json`([iOS 후속] `GoogleService-Info.plist`)은
  **FE 빌드**에 포함되나, **발송은 BE**가 담당.

### 2.4 BE 작업 체크리스트
- [ ] `device` 테이블/엔티티 (user, token, platform, appVersion, updatedAt)
- [ ] 디바이스 토큰 등록/해제 API
- [ ] Firebase Admin SDK 통합 + 서비스 계정 비밀 관리
- [ ] 기존 알림 이벤트 발생 지점에 푸시 발송 추가
- [ ] 무효 토큰 정리(피드백 처리)
- [ ] (옵션) 알림 설정 API
- [ ] payload 규격(딥링크) 합의

---

## 3. 앱 운영 / 인프라 부수 작업

### 3.1 CORS / 도메인 / 딥링크
- [ ] **CORS**: Capacitor WebView origin 허용. Android는 `https://localhost`
  (`server.androidScheme: 'https'` 기준), [iOS 후속] `capacitor://localhost`
  origin이 요청에 실림 → 허용 목록 추가. (또는 토큰 방식이므로 `withCredentials` 의존 ↓)
  - ⚠️ **(2026-08-22 코드 확인) 수정 위치 2곳**: 허용 origin 3개가
    `SecurityConfig.corsConfigurationSource()`와
    `WebSocketConfig.registerStompEndpoints()`에 **각각 하드코딩** — 두 곳 모두
    수정해야 하며 application.yml로 외부화 권장. 누락 시 첫 실기기 빌드부터
    전 API(및 STOMP)가 차단된다.
- [ ] **Universal Links / App Links**(권장, 선택): 커스텀 스킴 대신
  `https://triptyche.cloud/...` 딥링크 쓰려면 `apple-app-site-association`,
  `assetlinks.json`을 도메인에 호스팅.

### 3.2 클라이언트 식별 / 버전 정책
- [ ] 요청 헤더에 `X-Client: app-ios|app-android|web`, `X-App-Version` 수용
  (분기/로깅/통계).
- [ ] **강제 업데이트** 지원: `GET /v1/app/config` → `{ minSupportedVersion,
  latestVersion, updateUrl }` 반환 → 앱이 구버전 차단/유도.

### 3.3 S3 업로드 / Presigned URL
- [ ] 현행 presigned URL 방식 그대로 사용 가능. 단 S3 CORS 정책에 앱 origin
  추가 필요할 수 있음(직접 PUT 업로드 시).
- [ ] 대용량/HEIC 업로드 타임아웃·재시도 정책은 FE에 이미 구현(현행 유지).

### 3.4 보안 / 모니터링
- [ ] 토큰 탈취 대비 refresh 회전 + 디바이스 바인딩 고려.
- [ ] 푸시/인증 신규 엔드포인트 rate limit.
- [ ] 앱 트래픽 구분 로깅(클라이언트별 에러율 모니터링).
- [ ] **(앱 무관, 즉시 수정 권장 — 2026-08-22 발견)** STOMP
  `/topic/share-notifications/{recipientId}`에 cross-user 구독 가드 없음 —
  `StompTopicAuthInterceptor`는 `/topic/media-processed/{userId}`만 보호하고
  있어 타 유저의 알림 구독이 가능한 상태.

---

## 4. 마일스톤 / 의존성

| 단계 | BE 작업 | FE 의존 |
|------|---------|---------|
| M1 (P0) | 토큰 인증 + OAuth 딥링크 콜백 | FE 로그인 플로우(B Epic) |
| M2 (P0) | 디바이스 등록 API + 푸시 발송 | FE 푸시 등록/수신(C Epic) |
| M3 (iOS 후속) | Sign in with Apple | iOS 심사 |
| M4 (P1) | CORS/딥링크 도메인, 버전 정책 | 앱 셸/강제 업데이트 |
| M5 (P1) | 알림 설정 API | 설정 화면 |

> **출시 블로커(Android)**: M1, M2. (M3는 iOS 후속 단계의 블로커.)
> FE/BE 병렬 진행하되 인터페이스(토큰 응답 형식, 딥링크 스킴, 푸시 payload
> 규격)를 **선합의**해야 통합 지연을 막는다.

---

## 5. 선합의 필요 인터페이스 (FE ↔ BE 계약)

1. **딥링크 스킴**: `triptyche://auth/callback`, `triptyche://trip/{tripKey}` 등 확정
2. **토큰 응답 형식**: 필드명(`accessToken`/`refreshToken`/`expiresIn`), 만료/회전 정책
3. **one-time code 교환** 사용 여부
4. **푸시 payload `data` 스키마**: `type`, `deeplink`, `resourceId`
5. **클라이언트 헤더**: `X-Client`, `X-App-Version`
6. **앱 origin CORS** 목록

---

## 부록: 출처 (2026-06 검색)

- [Push Notifications - Firebase (Capacitor Docs)](https://capacitorjs.com/docs/guides/push-notifications-firebase)
- [@capacitor-firebase/messaging (npm)](https://www.npmjs.com/package/@capacitor-firebase/messaging)
- [Capawesome — Push Notifications Guide](https://capawesome.io/blog/the-push-notifications-guide-for-capacitor/)
- [5 Steps to Implement OAuth2 in Capacitor Apps (PKCE)](https://capgo.app/blog/5-steps-to-implement-oauth2-in-capacitor-apps/)
- [Apple App Review Guidelines (4.8 등)](https://developer.apple.com/app-store/review/guidelines/)
