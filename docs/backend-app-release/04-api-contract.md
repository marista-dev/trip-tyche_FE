# API 계약 — FE가 이미 호출하고 있는 형태

> 상위: [README](README.md)
> **이 문서의 형태를 바꾸면 FE 수정이 필요하다.** 작업 전에 반드시 먼저 읽을 것.

FE는 이미 구현·배포되어 있고 아래 형태로 요청을 보낸다. 각 항목에 **FE 코드 위치**를 적어두었으니, 형태를 바꿔야 할 이유가 생기면 그 파일을 함께 고쳐야 한다.

---

## 0. 공통 응답 봉투

모든 응답은 기존 `RestResponse` 형태를 그대로 쓴다. FE는 **`response.data.data`** 를 실제 값으로 읽는다(`src/libs/apis/shared/utils.ts`의 `toResult`).

```json
{
  "status": 200,
  "code": 0,
  "message": "정상 처리 되었습니다.",
  "data": <실제 값>,
  "httpStatus": "OK"
}
```

⚠️ **`data`가 없거나 `null`이면 FE는 "성공했지만 값이 없음"으로 처리한다.** 인증 관련 응답에서 이런 일이 생기면 사용자가 로그인 화면으로 튕긴다. 성공 시 반드시 `data`를 채울 것.

---

## 1. OAuth 시작 (앱)

**FE 코드**: `src/pages/SigninPage.tsx` — `handleLoginButtonClick`

```
GET {API_BASE_URL}/oauth2/authorization/{kakao|google}
      ?client=app
      &redirect_uri=triptyche%3A%2F%2Fauth%2Fcallback
```

- 앱은 이 URL을 **인앱 브라우저**(`@capacitor/browser`)로 연다.
- `redirect_uri`는 URL 인코딩되어 있다. 디코딩하면 `triptyche://auth/callback`.
- 웹은 `client` 파라미터 없이 기존과 동일하게 `window.location.href`로 이동한다.

---

## 2. OAuth 콜백 (서버 → 앱)

**FE 코드**: `src/platform/native/appShell.ts` — `setupAuthDeepLink`

서버는 인증 성공 후 아래로 **302 리다이렉트**한다.

```
triptyche://auth/callback?code=<1회용 code>
```

- FE는 `url.startsWith('triptyche://auth/callback')`으로 판별한 뒤, `?` 뒤를 `URLSearchParams`로 파싱해 **`code`** 를 꺼낸다.
- `code`가 없으면 오류 로그만 남기고 로그인 화면에 머무른다.
- 파라미터 이름은 반드시 **`code`**. 다른 이름을 쓰면 FE가 못 읽는다.

**Android intent-filter** (`android/app/src/main/AndroidManifest.xml`):
```xml
<data android:scheme="triptyche" android:host="auth" />
```
스킴/호스트를 바꾸려면 이 매니페스트와 `appShell.ts`의 `AUTH_CALLBACK_SCHEME`을 함께 고쳐야 한다.

---

## 3. 토큰 교환 (신규 · 필수)

**FE 코드**: `src/platform/native/auth.ts` — `exchangeCodeForTokens`

```
POST /v1/auth/token/exchange
Content-Type: application/json
인증: 불필요 (permitAll)

{ "code": "<1회용 code>" }
```

**FE가 읽는 필드**
```
response.data.data.accessToken    ← 필수. 없으면 실패 처리
response.data.data.refreshToken   ← 선택(있으면 저장)
response.data.data.expiresIn      ← 현재 미사용
```

**성공 응답 예시**
```json
{
  "status": 200, "code": 0, "message": "정상 처리 되었습니다.",
  "data": { "accessToken": "eyJ...", "refreshToken": "eyJ...", "expiresIn": 3600 },
  "httpStatus": "OK"
}
```

**실패**: 401. FE는 로그인 화면에 머무른다.

⚠️ 현재 이 경로로 요청하면 `{"status":401,"code":1001,"message":"인증이 필요합니다."}`가 온다. **`permitAll` 등록이 빠지면 이 응답이 계속 나온다.**

---

## 4. 토큰 갱신 (신규 · 필수)

**FE 코드**: `src/platform/native/auth.ts` — `refreshAccessToken`
**호출 시점**: `src/libs/apis/shared/interceptors.ts` — 보호 API가 401을 줄 때 자동

```
POST /v1/auth/token/refresh
Content-Type: application/json
인증: 불필요 (permitAll)

{ "refreshToken": "eyJ..." }
```

응답 형태는 3번과 동일.

**FE 동작 흐름**
```
보호 API 호출 → 401
  → refreshAccessToken() 호출
     → 성공: 새 토큰 저장 후 원래 요청 자동 재시도 (사용자는 모름)
     → 실패: 저장 토큰 삭제 + 로그인 화면
```

⚠️ 기존 `POST /v1/auth/refresh`(쿠키 기반)와 **경로가 다르다.** 웹은 기존 것을, 앱은 새 것을 쓴다.

**회전(rotation)**: 응답에 `refreshToken`이 있으면 FE가 저장된 값을 갱신하므로, 서버가 회전을 켜도 FE 수정이 필요 없다.

---

## 5. 게스트 로그인 (기존 · 변경 금지)

**FE 코드**: `src/libs/apis/user.ts` — `postGuestLogin`

```
POST /v1/auth/guest
```

**FE가 읽는 필드**: `response.data.data` — **토큰 문자열 그 자체**

```json
{ "status": 200, "code": 0, "data": "eyJ...", "httpStatus": "OK" }
```

앱은 이 문자열을 access 토큰으로 저장한다. **`data`를 객체로 바꾸면 앱의 게스트 로그인이 깨진다.**

실측으로 정상 동작을 확인했다(게스트 진입 → `/v1/trips` 호출 → 재시작 후 세션 유지).

---

## 6. 보호 API 인증 (기존 · 변경 불필요)

**FE 코드**: `src/libs/apis/shared/interceptors.ts` — 요청 인터셉터

앱은 모든 요청에 아래 헤더를 싣는다.

```
Authorization: Bearer <accessToken>
```

`JWTAuthenticationFilter`가 이미 **Authorization 헤더를 쿠키보다 먼저** 확인하므로 **서버 수정이 필요 없다.** 실측 확인 완료.

앱은 `withCredentials`를 끈다(`src/libs/apis/shared/client.ts`) — 쿠키를 쓰지 않는다.

---

## 7. 디바이스 토큰 등록 (신규 · 푸시용)

**FE 코드**: 예정 — Phase 4-3 (`src/domains/notification/hooks/usePushRegistration.ts`)

```
POST /v1/devices
인증: 필요 (Bearer)

{ "token": "<FCM 토큰>", "platform": "android", "appVersion": "1.0.0" }
```

```
DELETE /v1/devices/{token}
인증: 필요 (Bearer)
```

이 두 개는 **FE가 아직 호출하지 않는다.** 백엔드가 먼저 만들어두면 FE에서 붙인다. 위 형태를 유지해달라.

---

## 8. 푸시 payload (신규 · 푸시용)

**FE 코드**: 예정 — Phase 4-4

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

- `data`의 값은 **모두 문자열**이어야 한다 (FCM 제약).
- `deeplink`가 없으면 앱은 홈으로 보낸다.

---

## 변경 시 함께 고쳐야 하는 FE 파일

| 바꾸는 것 | FE에서 고칠 파일 |
|---|---|
| 딥링크 스킴 | `android/app/src/main/AndroidManifest.xml`, `src/platform/native/appShell.ts` |
| `code` 파라미터 이름 | `src/platform/native/appShell.ts` |
| 토큰 응답 필드명 | `src/platform/native/auth.ts` |
| 교환/갱신 엔드포인트 경로 | `src/platform/native/auth.ts` |
| 게스트 응답 형태 | `src/libs/apis/user.ts` |
| 공통 응답 봉투 | `src/libs/apis/shared/utils.ts` (웹까지 영향) |

**이 표에 해당하는 변경은 FE 수정과 배포가 함께 필요하다.** 가능하면 위 계약을 그대로 구현하는 편이 전체 일정에 유리하다.
