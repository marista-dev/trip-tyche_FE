# 앱 출시를 위한 백엔드 작업 — 요구사항 분석서

> 작성일: 2026-08-22 · 대상: 백엔드 개발자
> 대상 저장소: `triptyche-backend` (Spring Boot / Java 21)
> **프론트엔드는 이미 완료·배포되어 있으며, 이 작업 중에 FE를 수정할 필요가 없도록 설계되었다.**

## 이 문서를 읽는 법

| 문서 | 내용 |
|---|---|
| **README.md** (이 문서) | 배경, 전체 그림, 작업 순서, 완료 기준 |
| [01-auth.md](01-auth.md) | **M1 인증** — OAuth 딥링크 + 토큰 교환/갱신 (출시 블로커) |
| [02-push.md](02-push.md) | **M2 푸시** — 디바이스 토큰 등록 + FCM 발송 (출시 블로커) |
| [03-infra-security.md](03-infra-security.md) | CORS, STOMP 보안 결함, 클라이언트 식별 |
| [04-api-contract.md](04-api-contract.md) | **FE가 이미 호출하는 계약** — 필드명·형식 확정본 |

작업 전 [04-api-contract.md](04-api-contract.md)를 먼저 읽을 것. FE 코드가 이미 그 형태로 요청을 보내고 있어, **이 계약을 바꾸면 FE 수정이 필요해진다.**

---

## 1. 배경 — 왜 이 작업이 필요한가

### 앱을 만든 이유

안드로이드 웹 브라우저에서 사진을 업로드하면 **시스템이 EXIF의 GPS 좌표를 제거**한다. 트립티케는 사진 EXIF의 GPS로 지도에 핀을 찍는 서비스이므로, 안드로이드 유저는 핵심 기능을 쓸 수 없었다. 이를 해결하려면 `ACCESS_MEDIA_LOCATION` 권한을 가진 네이티브 앱이 필요하다.

Capacitor로 안드로이드 앱을 만들었고, **EXIF GPS 보존은 실기기에서 검증 완료**했다.

| 항목 | 원본 사진 EXIF | 서버 저장값 |
|---|---|---|
| 촬영시각 | `2023:07:04 15:20:30` | `2023-07-04T15:20:30` ✅ |
| 위도/경도 | 37.5665 / 126.9780 | 37.5665 / 126.978 ✅ |

### 지금 막혀 있는 것

**앱에 로그인할 방법이 없다.** 이것이 유일하고 결정적인 출시 블로커다.

현재 OAuth는 인증 성공 후 `OAuth2LoginSuccessHandler`가 토큰을 **쿠키로 심고** `spring.redirect.url`(웹 도메인)로 리다이렉트한다. 앱에서는 두 가지가 모두 깨진다.

1. **쿠키가 살아남지 않는다.** 앱의 WebView는 `https://localhost` origin이고, 쿠키는 `Domain=triptyche.cloud`로 발급된다. 실측 결과 `POST /v1/auth/guest`가 200으로 토큰을 발급해도 **다음 요청이 401**이었다.
2. **웹 도메인으로 리다이렉트되면 앱으로 돌아올 수 없다.** 인앱 브라우저가 웹사이트를 띄운 채 끝난다.

그래서 앱은 **토큰을 직접 받아 보관하고 `Authorization: Bearer`로 보내는 방식**으로 전환했다. 서버 쪽에서 그 토큰을 **건네줄 창구**만 만들면 된다.

### 이미 유리한 조건

- `JWTAuthenticationFilter`는 **Authorization 헤더를 쿠키보다 먼저** 확인한다. 즉 **보호 API는 이미 Bearer로 동작한다.** 실측으로 확인했다(게스트 토큰으로 `/v1/trips` 정상 호출).
- `POST /v1/auth/guest`는 이미 응답 **body로 토큰을 반환**한다. 새 엔드포인트의 참고 선례다.
- 미디어 업로드 파이프라인(presigned URL → S3 → 메타데이터)은 **수정 불필요**. 앱에서 그대로 동작한다.

**즉 남은 일은 "토큰을 앱에 전달하는 경로"와 "푸시"뿐이다.**

---

## 2. 전체 그림 — 앱 로그인이 어떻게 흘러야 하는가

```
[앱]  카카오/구글 버튼 탭
  │
  │  인앱 브라우저로 오픈 (@capacitor/browser)
  ▼
  GET {API}/oauth2/authorization/kakao?client=app&redirect_uri=triptyche%3A%2F%2Fauth%2Fcallback
  │
  ▼
[백엔드]  기존 OAuth2 인증 (변경 없음)
  │
  ▼
[백엔드]  OAuth2LoginSuccessHandler
  │   client=app 이면:
  │     1) 1회용 code 발급 (Redis, TTL 60초)
  │     2) 302 → triptyche://auth/callback?code=<code>
  │   아니면 기존 웹 흐름 그대로 (쿠키 + 웹 도메인 리다이렉트)
  ▼
[앱]  딥링크 수신 (appUrlOpen 리스너) → 인앱 브라우저 닫기
  │
  ▼
  POST {API}/v1/auth/token/exchange   { "code": "<code>" }
  │
  ▼
[백엔드]  code 검증·1회 소비 → { accessToken, refreshToken, expiresIn }
  │
  ▼
[앱]  토큰을 기기 저장소에 보관 → 이후 모든 요청에 Authorization: Bearer
```

**왜 토큰을 딥링크에 직접 싣지 않고 code를 거치는가**: 딥링크 URL은 OS 로그와 다른 앱의 인텐트 기록에 남을 수 있다. 30일짜리 refresh 토큰이 거기 남으면 회수가 불가능하다. 60초짜리 1회용 code면 유출돼도 피해가 제한된다. FE는 이미 이 방식으로 구현되어 있다.

---

## 3. 작업 목록과 순서

| 순서 | 작업 | 문서 | 성격 |
|---|---|---|---|
| 1 | **CORS에 앱 origin 추가** | [03](03-infra-security.md) | 5분. 이게 없으면 아무것도 검증 못 함 |
| 2 | **STOMP 구독 가드** | [03](03-infra-security.md) | 앱과 무관한 기존 보안 결함. 작고 급함 |
| 3 | **M1 인증** | [01](01-auth.md) | **출시 블로커.** 이게 끝나면 앱이 "쓸 수 있는 앱"이 됨 |
| 4 | **M2 푸시** | [02](02-push.md) | **출시 블로커.** Firebase 프로젝트 생성은 리드타임이 있으니 미리 시작 |
| 5 | 클라이언트 식별·버전 정책 | [03](03-infra-security.md) | P1. 없어도 출시 가능 |

1·2번을 먼저 하는 이유는 순서상 의존이 아니라 **비용이 거의 없으면서 이후 모든 검증을 가능하게 하기 때문**이다.

---

## 4. 완료 기준

아래가 모두 통과하면 앱 출시를 위한 백엔드 작업이 끝난 것이다.

- [ ] 앱에서 카카오 로그인 → 인앱 브라우저 → 앱으로 복귀 → 홈 진입
- [ ] 앱에서 구글 로그인도 동일하게 동작
- [ ] 앱을 완전 종료 후 재시작해도 로그인 유지
- [ ] access 토큰 만료 후 API 호출 시 자동 갱신되어 사용자가 눈치채지 못함
- [ ] 앱에서 로그아웃 시 서버의 refresh 토큰이 무효화됨
- [ ] 앱이 **종료된 상태**에서 공유 요청을 받으면 푸시 알림이 도착
- [ ] 알림을 탭하면 해당 화면으로 진입
- [ ] 앱이 켜져 있을 때는 기존 STOMP 배너로 표시되고 푸시와 중복되지 않음
- [ ] 웹(triptyche.cloud)이 기존과 동일하게 동작 — **회귀 없음**

마지막 항목이 중요하다. 이 작업의 모든 변경은 **웹의 쿠키 흐름을 건드리지 않고 앱 경로만 추가**하는 방향이어야 한다.

---

## 5. 검증 환경

FE 저장소에 앱을 실기기에서 돌릴 수 있는 환경이 준비되어 있다.

```bash
# 백엔드 로컬 실행
bash scripts/dev-start.sh          # (FE 저장소의 스크립트, Docker + Spring Boot)

# 앱 빌드·설치 (FE 저장소에서)
npm run cap:sync
cd android && ./gradlew installDebug
```

- 에뮬레이터에서 호스트의 백엔드는 **`http://10.0.2.2:8080`**으로 접근한다(`localhost`는 에뮬레이터 자신).
- 딥링크는 앱 없이도 주입해 테스트할 수 있다:
  ```bash
  adb shell am start -a android.intent.action.VIEW \
    -d "triptyche://auth/callback?code=TESTCODE123"
  ```
  현재 이 명령을 실행하면 앱이 `POST /v1/auth/token/exchange`로 `{"code":"TESTCODE123"}`을 보내고 401을 받는다. **엔드포인트를 만들면 그 자리에서 붙는다.**

---

## 6. 참고 — 이 작업에서 건드리지 말아야 할 것

| 대상 | 이유 |
|---|---|
| 웹의 쿠키 발급 흐름 | 운영 중인 웹이 이 방식으로 동작한다. 앱 경로를 **추가**하되 웹 경로는 그대로 둔다 |
| `JWTAuthenticationFilter`의 토큰 추출 순서 | 이미 Bearer 우선이라 앱이 그대로 동작한다. 쿠키·쿼리 파라미터 폴백도 웹·WebSocket이 쓴다 |
| presigned URL / 미디어 파이프라인 | 앱에서 이미 정상 동작을 확인했다 |
| `POST /v1/auth/guest` 응답 형식 | 앱이 이 형식(`data`에 토큰 문자열)에 의존한다 |
