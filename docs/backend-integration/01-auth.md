# 인증 — M1 결과

> 상위: [README](README.md) · BE PR #197 · **배포 완료**

## 1. FE는 이미 맞춰져 있다

`src/platform/native/auth.ts`가 확정된 계약과 정확히 일치한다. **손댈 것 없다.**

| FE 코드 | 서버 엔드포인트 |
|---|---|
| `exchangeCodeForTokens()` | `POST /v1/auth/token/exchange` |
| `refreshAccessToken()` | `POST /v1/auth/token/refresh` |

응답은 둘 다 같은 형태다.

```json
{
  "status": 200, "code": 0,
  "data": { "accessToken": "eyJ...", "refreshToken": "eyJ...", "expiresIn": 3600 }
}
```

`expiresIn`은 아직 FE가 쓰지 않는다(만료는 401로 감지). 필요해지면 쓰면 된다.

---

## 2. ⚠️ refresh 토큰이 매번 바뀐다 — 반드시 저장할 것

서버가 **refresh 토큰 회전(rotation)**을 적용했다. 갱신할 때마다 **새 refreshToken이 내려오고 이전 것은 10초 유예 후 무효화**된다.

`saveTokens()`가 응답의 `refreshToken`을 항상 저장하고 있어 지금은 문제없다.
다만 이 동작을 **깨뜨리면 사용자가 다음 갱신에서 튕긴다.** 리팩터링할 때 주의.

```ts
// auth.ts — 이 부분을 건드리지 말 것
await saveTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
```

### 왜 회전하는가

토큰에 세션 식별자(`sid`) 클레임이 생겼고, Redis 키가 `refresh_token:{email}:{sessionId}`로 바뀌었다.
그 전에는 사용자당 슬롯이 하나여서 **웹과 앱에 동시 로그인이 불가능**했다(앱에 로그인하면 웹이 한 시간 안에 튕겼다).
지금은 웹·앱이 각자 세션을 갖는다.

> 배포 시점에 기존 로그인 사용자가 **1회 강제 재로그인**됐다. `sid`가 없는 구버전 토큰을 만료 처리했기 때문이다. 이미 지나간 일이다.

---

## 3. OAuth 실패도 딥링크로 돌아온다 (신규)

인증에 실패하면 서버가 앱으로 돌려보낸다. 이전에는 웹 페이지를 띄운 채 끝나서 **앱이 무한 대기**했다.

```
triptyche://auth/callback?error=<코드>
```

| `error` 값 | 의미 |
|---|---|
| `email_already_registered` | 다른 provider로 이미 가입된 이메일 |
| `server_error` | 그 외 전부 (원인은 서버 로그에만 남긴다) |

**현재 FE는 안전하게 동작한다.** `appShell.ts`가 `code`가 없으면 로그만 남기고 로그인 화면에 머무른다.

개선하려면 `setupAuthDeepLink()`에서 `error`를 읽어 토스트를 띄우면 된다.

```ts
const params = new URLSearchParams(query);
const code = params.get('code');
const error = params.get('error');

if (error) {
    showToast(error === 'email_already_registered'
        ? '이미 다른 방법으로 가입된 이메일입니다.'
        : '로그인에 실패했어요. 다시 시도해 주세요.');
    return;
}
```

사용자가 Custom Tab을 중간에 닫은 경우에도 이 경로로 돌아온다.

---

## 4. 로그아웃이 Bearer로도 동작한다

`POST /v1/auth/logout`에 `Authorization: Bearer` 헤더만 실으면 **서버의 refresh 토큰이 무효화**된다.
쿠키가 없어도 된다.

**로그아웃 시 반드시 호출할 것.** 안 하면 탈취된 refresh 토큰이 30일간 살아 있다.
access 토큰의 `sid`가 해당 세션만 가리키므로 **다른 기기의 로그인은 유지된다.**

---

## 5. CORS에 앱 origin이 추가됐다

허용 목록에 `https://localhost`(Capacitor Android WebView)가 들어갔다.
`application.yml`로 외부화되어 `SecurityConfig`와 `WebSocketConfig`가 같은 목록을 본다.

**두 가지가 가능해졌다.**

- `CapacitorHttp` 우회 없이 정공법으로 REST 호출
- **STOMP WebSocket 연결** — 이전에는 우회 대상이 아니라 앱에서 아예 막혀 있었다

급한 작업은 아니지만, `CapacitorHttp`는 요청/응답 처리가 브라우저와 미묘하게 달라서 줄여두면 디버깅이 편해진다.

---

## 6. STOMP 구독에 소유자 검증이 걸렸다

`/topic/share-notifications/{recipientId}` 구독 시 **경로의 식별자와 인증 주체가 일치하는지** 검사한다.
남의 `recipientId`로 구독하면 거부된다.

FE는 **자기 `userId`로만 구독**해야 한다. `/topic/media-processed/{userId}`도 동일하다.

> 이 결함은 앱과 무관하게 웹에도 있었다. 공유 알림에 보낸 사람 닉네임과 여행 정보가 들어 있어 개인정보 노출이었다.

---

## 7. 바뀌지 않은 것

| 대상 | 상태 |
|---|---|
| `POST /v1/auth/guest` | 응답 `data`가 **토큰 문자열 그 자체**. 변경 없음 |
| `POST /v1/auth/refresh` (쿠키 기반) | 웹 전용으로 유지. 앱은 `/v1/auth/token/refresh` |
| 공통 응답 봉투 | `response.data.data` 그대로 |
| 보호 API 인증 | `Authorization: Bearer` — `JWTAuthenticationFilter`가 쿠키보다 먼저 확인 |

---

## 8. 에러 코드

인증 관련 실패는 **전부 HTTP 401**이다. 인터셉터가 401을 기준으로 갱신·로그아웃을 판단하므로 그대로 두면 된다.

| `code` | 의미 |
|---|---|
| `2002` | 유효하지 않은 토큰 |
| `2008` | refresh 토큰 만료 또는 서버에 없음 |
| `2010` | 1회용 code가 만료·미존재·이미 사용됨 (교환 실패) |
| `1001` | 인증이 필요함 — **이게 나오면 서버의 `permitAll` 설정 누락**이다 |
