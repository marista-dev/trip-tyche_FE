# M1. 인증 — OAuth 딥링크 + 토큰 교환/갱신

> 상위: [README](README.md) · **출시 블로커** · 이게 없으면 앱에 로그인할 수 없다

## 문제

`OAuth2LoginSuccessHandler`(`global/oauth/OAuth2LoginSuccessHandler.java`)는 인증 성공 후:

```java
cookieUtil.setCookie(response, "access_token", accessToken, ...);
cookieUtil.setCookie(response, "refresh_token", refreshToken, ...);
response.sendRedirect(redirectUrl);   // spring.redirect.url = https://triptyche.cloud
```

앱에서는 둘 다 무용하다.

- **쿠키**: 앱 WebView의 origin은 `https://localhost`인데 쿠키는 `Domain=triptyche.cloud`로 발급된다(`global/util/CookieUtil.java`). 게다가 인앱 브라우저와 앱 WebView는 쿠키 저장소가 분리되어 있다. **실측: `/v1/auth/guest`가 200을 줘도 다음 요청이 401.**
- **리다이렉트**: 웹 도메인으로 보내면 인앱 브라우저가 웹사이트를 띄운 채 끝나고 앱으로 돌아오지 않는다.

## 요구사항

### R1. OAuth 콜백을 앱 딥링크로 분기

**변경 대상**: `OAuth2LoginSuccessHandler.onAuthenticationSuccess()`

앱에서 시작한 요청이면 쿠키 대신 **1회용 code**를 딥링크로 돌려준다. 웹 요청이면 **기존 동작 그대로**.

```
앱 요청:  302 → triptyche://auth/callback?code=<1회용 code>
웹 요청:  기존 쿠키 + https://triptyche.cloud 리다이렉트 (변경 없음)
```

**앱/웹 판별**: 앱은 OAuth 시작 URL에 다음 쿼리를 붙인다(FE 구현 완료).

```
GET /oauth2/authorization/kakao?client=app&redirect_uri=triptyche%3A%2F%2Fauth%2Fcallback
```

⚠️ **문제**: Spring Security의 OAuth2 인가 요청은 리다이렉트를 거치므로, 시작 시점의 쿼리 파라미터가 콜백 시점까지 자동으로 살아남지 않는다. 다음 중 하나로 이어야 한다.

- **(권장) `state` 파라미터에 실어 보내기** — `OAuth2AuthorizationRequestResolver`를 커스터마이즈해 `client=app`과 `redirect_uri`를 `state`에 인코딩하고, 성공 핸들러에서 꺼낸다. OAuth 표준 메커니즘이라 CSRF 방어와도 자연스럽게 맞물린다.
- **(대안) 앱 전용 경로 분리** — `/oauth2/authorization/app/{provider}` 같은 별도 진입점을 만들고 세션/Redis에 표시를 남긴다. 구현은 단순하나 진입점이 두 벌이 된다.

어느 쪽이든 **`redirect_uri`는 반드시 화이트리스트로 검증**한다. 임의 스킴을 허용하면 인증 결과를 공격자 앱으로 보낼 수 있다.

```java
private static final Set<String> ALLOWED_APP_REDIRECTS = Set.of("triptyche://auth/callback");
```

**1회용 code 사양**

| 항목 | 값 | 이유 |
|---|---|---|
| 저장소 | Redis (기존 `RefreshTokenRepository`와 동일 인프라) | 이미 쓰고 있음 |
| 키 | `oauth:code:{code}` | |
| 값 | 사용자 식별자 + provider (토큰 자체를 넣어도 되나 최소 정보 권장) | |
| TTL | **60초** | 앱이 즉시 교환하므로 충분. 길면 유출 위험만 커짐 |
| 형식 | 최소 128비트 난수 (`SecureRandom` → URL-safe Base64) | 추측 불가해야 함 |
| 재사용 | **1회 소비 후 즉시 삭제** | |

**왜 토큰을 딥링크에 직접 싣지 않는가**: 딥링크 URL은 OS 로그와 다른 앱의 인텐트 기록에 남을 수 있다. 30일짜리 refresh 토큰이 남으면 회수 불가다. 60초 code면 유출돼도 피해가 제한된다.

---

### R2. 토큰 교환 엔드포인트 (신규)

```
POST /v1/auth/token/exchange
Content-Type: application/json
인증: 불필요 (permitAll)

요청  { "code": "<1회용 code>" }
```

**응답 (성공)**
```json
{
  "status": 200,
  "code": 0,
  "message": "정상 처리 되었습니다.",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 3600
  },
  "httpStatus": "OK"
}
```

**FE가 읽는 경로**: `response.data.data.accessToken`, `.refreshToken`
`expiresIn`은 현재 FE가 쓰지 않지만(만료는 401로 감지) 향후를 위해 포함 권장. 초 단위.

**실패**: code가 없거나·만료·이미 사용됨 → **401**. FE는 실패 시 로그인 화면에 머무른다.

⚠️ **`permitAll` 등록 필수**. 지금 이 경로로 요청하면 `SecurityConfig`가 인증을 요구해 401이 나온다(실측 확인).

---

### R3. 토큰 갱신 엔드포인트 (신규)

기존 `POST /v1/auth/refresh`(`AuthController:35`)는 refresh 토큰을 **쿠키에서만** 읽는다. 앱에는 그 쿠키가 없다.

```
POST /v1/auth/token/refresh
Content-Type: application/json
인증: 불필요 (permitAll)

요청  { "refreshToken": "eyJ..." }
```

**응답**: R2와 동일한 형태(`data.accessToken`, `data.refreshToken`, `data.expiresIn`).

**실패**: 만료·위조·서버에 없는 토큰 → **401**. FE는 저장된 토큰을 지우고 로그인 화면으로 보낸다.

**FE 동작**: 보호 API가 401을 주면 인터셉터가 이 엔드포인트로 갱신을 시도하고, 성공하면 **원래 요청을 자동 재시도**한다(`src/libs/apis/shared/interceptors.ts`). 실패해야만 로그아웃된다. 즉 **응답이 정확해야 사용자가 갑자기 튕기지 않는다.**

**refresh 토큰 회전(rotation) 권장**: 갱신 시 새 refresh 토큰을 함께 발급하고 이전 것을 무효화한다. FE는 응답에 `refreshToken`이 있으면 저장된 값을 갱신하므로 **서버가 회전을 선택해도 FE 수정이 필요 없다.**

---

### R4. 로그아웃

기존 `POST /v1/auth/logout`(`AuthController:55`)도 refresh 토큰을 쿠키에서 읽는다.

앱에서는 `Authorization: Bearer`로 access 토큰이 실려 오므로, **인증된 사용자 기준으로 서버의 refresh 토큰을 무효화**하도록 보완한다. 쿠키가 있으면 기존 동작도 유지한다.

FE는 로그아웃 시 기기 저장소의 토큰을 지운다. 서버 무효화가 없으면 **탈취된 refresh 토큰이 30일간 유효**하게 남으므로 반드시 처리한다.

---

### R5. 게스트 로그인 — 확인만

`POST /v1/auth/guest`는 이미 응답 body로 토큰을 반환하며 **앱에서 정상 동작을 확인했다**(게스트 진입 → `/v1/trips` 호출 → 재시작 후 세션 유지).

응답 형식(`data`가 토큰 문자열)에 FE가 의존하므로 **바꾸지 말 것.**

```json
{ "status": 200, "code": 0, "data": "eyJ...", "httpStatus": "OK" }
```

참고: 게스트에게는 refresh 토큰이 없어 4시간 후 만료되면 로그인 화면으로 떨어진다. 의도된 동작이다.

---

## 작업 체크리스트

- [ ] OAuth 시작 시 `client=app`·`redirect_uri`를 `state`(또는 대안)로 콜백까지 전달
- [ ] `redirect_uri` 화이트리스트 검증
- [ ] 1회용 code 발급·저장(Redis, TTL 60초, 1회 소비)
- [ ] `OAuth2LoginSuccessHandler`에 앱 분기 추가 — **웹 경로는 그대로**
- [ ] `POST /v1/auth/token/exchange` 신규 + `permitAll`
- [ ] `POST /v1/auth/token/refresh` 신규 + `permitAll`
- [ ] refresh 토큰 회전·무효화
- [ ] `POST /v1/auth/logout`이 Bearer 인증 기준으로도 동작
- [ ] 웹 로그인 회귀 없음 확인

## 검증

```bash
# 1) 교환 엔드포인트 단독 확인 (code는 임의값 → 401이어야 정상)
curl -i -X POST http://localhost:8080/v1/auth/token/exchange \
  -H "Content-Type: application/json" -d '{"code":"INVALID"}'
# 기대: 401. 만약 "인증이 필요합니다"(code 1001)가 나오면 permitAll 등록이 빠진 것

# 2) 딥링크 주입 → 앱이 교환 요청을 보내는지 (앱 설치 상태에서)
adb shell am start -a android.intent.action.VIEW \
  -d "triptyche://auth/callback?code=<실제 발급 code>"
adb logcat | grep token/exchange
```

**최종 확인**: 앱에서 카카오 로그인 → 인앱 브라우저 → 자동으로 앱 복귀 → 홈 진입 → 앱 완전 종료 후 재시작 시 로그인 유지.

## 주의

| 항목 | 내용 |
|---|---|
| 웹 회귀 | 이 작업의 모든 변경은 **앱 경로 추가**여야 한다. 웹의 쿠키 발급·리다이렉트를 바꾸면 운영 중인 웹이 깨진다 |
| `JWTAuthenticationFilter` | 이미 Bearer를 쿠키보다 먼저 확인한다. **수정 불필요** |
| 딥링크 스킴 | `triptyche://auth/callback` 고정. 바꾸면 FE의 `AndroidManifest.xml` intent-filter와 `src/platform/native/appShell.ts`를 함께 고쳐야 한다 |
| 에러 응답 | 실패는 반드시 **401**로. FE 인터셉터가 401을 기준으로 갱신·로그아웃을 판단한다 |
