# 인프라 · 보안 · 운영

> 상위: [README](README.md) · CORS와 STOMP 가드는 **가장 먼저** 처리 권장 (비용이 거의 없고 이후 검증을 가능하게 한다)

## 1. CORS — 앱 origin 허용 ⚡ 최우선

### 문제

허용 origin이 **세 곳에 하드코딩**되어 있고 앱 origin이 없다.

`global/config/SecurityConfig.java` (corsConfigurationSource):
```java
configuration.setAllowedOrigins(List.of(
        "https://triptyche.cloud",
        "https://www.triptyche.cloud",
        "http://localhost:3000"
));
```

`global/config/WebSocketConfig.java` (STOMP 엔드포인트)에도 **같은 목록이 중복**되어 있다.

앱 WebView의 origin은 **`https://localhost`**다(`capacitor.config.ts`의 `androidScheme: 'https'` 기준).

### 현재 상태

FE는 임시로 **CapacitorHttp**(네이티브 HTTP로 우회 → CORS 프리플라이트 미적용)를 켜서 REST API를 쓰고 있다. 하지만 **STOMP WebSocket은 우회 대상이 아니라 여전히 막혀 있다.** 즉 앱에서 실시간 알림이 동작하지 않는다.

### 요구사항

두 파일 모두에 앱 origin을 추가한다.

```java
"https://localhost",     // Capacitor Android WebView
"http://localhost",      // androidScheme를 http로 바꿀 경우 대비
```

**권장**: 목록을 `application.yml`로 외부화해 한 곳에서 관리한다. 지금은 한 곳만 고치고 다른 곳을 잊기 쉬운 구조다.

```yaml
cors:
  allowed-origins:
    - https://triptyche.cloud
    - https://www.triptyche.cloud
    - http://localhost:3000
    - https://localhost
```

### 검증

```bash
curl -i -X OPTIONS http://localhost:8080/v1/trips \
  -H "Origin: https://localhost" \
  -H "Access-Control-Request-Method: GET"
# 기대: Access-Control-Allow-Origin: https://localhost
```

앱에서는 STOMP 연결이 성립하는지로 확인한다. 이후 FE가 `CapacitorHttp` 의존을 줄일 수 있다.

---

## 2. STOMP 구독 가드 — 보안 결함 ⚡ 앱과 무관하게 급함

### 문제

`global/websocket/StompTopicAuthInterceptor.java`는 `/topic/media-processed/{userId}`에 대해서만 **다른 사용자의 구독을 차단**한다.

`/topic/share-notifications/{recipientId}`에는 **같은 가드가 없다.** 즉 인증된 사용자가 임의의 `recipientId`를 넣어 구독하면 **타인의 공유 알림을 실시간으로 받아볼 수 있다.**

공유 알림에는 보낸 사람의 닉네임과 여행 정보가 포함되므로 개인정보 노출이다.

### 요구사항

`media-processed`와 동일한 방식으로 `share-notifications`에도 구독 시 **경로의 식별자와 인증 주체가 일치하는지** 검증한다.

이 결함은 **앱 출시와 무관하게 현재 웹에서도 존재한다.** 우선 처리를 권한다.

### 검증

다른 사용자의 `recipientId`로 STOMP 구독을 시도했을 때 거부되는지 확인.

---

## 3. 클라이언트 식별 · 버전 정책 — P1

출시 필수는 아니지만 운영에 도움이 된다.

### 요청 헤더 수용

```
X-Client: app-android | app-ios | web
X-App-Version: 1.0.0
```

로깅·통계·클라이언트별 에러율 모니터링에 쓴다. **FE는 아직 이 헤더를 보내지 않는다** — 서버가 먼저 받아들일 준비를 해두면 FE에서 추가할 때 배포 순서를 신경 쓰지 않아도 된다.

### 강제 업데이트

```
GET /v1/app/config
인증: 불필요

응답 data:
{
  "minSupportedVersion": "1.0.0",
  "latestVersion": "1.0.0",
  "updateUrl": "https://play.google.com/store/apps/details?id=cloud.triptyche.app"
}
```

앱이 구버전이면 업데이트를 유도하거나 차단한다. **스토어 배포 앱은 되돌릴 수 없으므로**, 치명적 버그가 나왔을 때 이 장치가 없으면 구버전 사용자를 막을 방법이 없다. 출시 전에 넣어두는 편이 안전하다.

---

## 4. S3 / presigned URL — 확인만

**변경 불필요.** 앱에서 presigned URL 업로드가 정상 동작하는 것을 실기기에서 확인했다(사진 업로드 → 메타데이터 저장 → 지도 핀 생성).

S3 버킷 CORS에 앱 origin(`https://localhost`) 추가가 필요할 수 있으나, 현재 CapacitorHttp 우회로 동작 중이라 문제가 드러나지 않았다. **CORS 정식 적용(1번) 후 FE가 CapacitorHttp를 끄면 그때 확인**한다.

---

## 5. 보안 · 모니터링 권장 사항

| 항목 | 내용 |
|---|---|
| refresh 토큰 회전 | 갱신 시 새 토큰 발급 + 이전 무효화. FE는 응답의 `refreshToken`을 항상 저장하므로 서버가 회전을 켜도 FE 수정 불필요 |
| 디바이스 바인딩 | refresh 토큰에 기기 식별자를 묶으면 탈취 시 피해를 줄일 수 있다 (선택) |
| rate limit | `/v1/auth/token/exchange`, `/v1/auth/token/refresh`, `/v1/devices`에 적용. 특히 exchange는 code 무차별 대입 대상이다 |
| 로그 | 토큰·code를 로그에 남기지 않는다. 디버깅 시에도 앞 8자 정도만 |

---

## 처리 순서 요약

1. **CORS** (5분) — 이게 있어야 STOMP를 포함한 전체 검증이 가능해진다
2. **STOMP 가드** (작음) — 기존 보안 결함, 앱과 무관하게 급함
3. [M1 인증](01-auth.md) — 출시 블로커
4. [M2 푸시](02-push.md) — 출시 블로커
5. 클라이언트 헤더 · 강제 업데이트 — P1
