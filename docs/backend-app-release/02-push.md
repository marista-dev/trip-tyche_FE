# M2. 푸시 알림 — 디바이스 토큰 등록 + FCM 발송

> 상위: [README](README.md) · **출시 블로커** · 인프라 준비(Firebase)에 리드타임이 있으니 M1과 병행 시작 권장

## 문제

현재 알림은 **STOMP WebSocket 전용**이다(`global/config/WebSocketConfig.java`, `domain/notification/event/*`). WebSocket은 연결이 살아 있을 때만 동작하므로, **앱이 백그라운드로 내려가거나 종료되면 알림이 도달하지 않는다.**

모바일에서는 앱이 대부분의 시간 동안 꺼져 있다. "앱이 꺼져 있어도 도착하는 알림"이 없으면 공유 요청을 받아도 알 수 없다.

저장소 전체에 FCM·APNs·디바이스 토큰 관련 코드가 **하나도 없다**(`fcm|firebase|apns|push` 검색 결과 0건).

---

## 요구사항

### R1. 인프라 준비 (선행, 리드타임 있음)

- [ ] Firebase 프로젝트 생성 (기존 GCP 프로젝트 재사용 가능)
- [ ] Android 앱 등록 — 패키지명 **`cloud.triptyche.app`**
- [ ] `google-services.json` 발급 → **FE 저장소의 `android/app/`에 배치** (FE 담당)
- [ ] 서버용 **서비스 계정 키** 발급 → 백엔드 비밀 관리에 저장
- [ ] `build.gradle`에 `com.google.firebase:firebase-admin` 추가

⚠️ 서비스 계정 키는 **절대 저장소에 커밋하지 않는다.** 환경변수나 시크릿 매니저로 주입한다.

iOS는 이번 범위가 아니다(Android 단독 선출시). 나중에 APNs `.p8`을 Firebase에 등록하면 같은 FCM 채널로 발송된다.

---

### R2. 디바이스 토큰 등록/해제 (신규)

```
POST /v1/devices
인증: 필요 (Bearer)

요청  { "token": "<FCM 토큰>", "platform": "android", "appVersion": "1.0.0" }
응답  200 (body는 사용하지 않음)
```

```
DELETE /v1/devices/{token}
인증: 필요 (Bearer)
응답  200
```

**엔티티 설계**

| 컬럼 | 비고 |
|---|---|
| `id` | PK |
| `user_id` | FK. **한 사용자가 여러 기기** (1:N) |
| `token` | FCM 등록 토큰. **unique** |
| `platform` | `android` / `ios` |
| `app_version` | 클라이언트 버전 |
| `created_at` / `updated_at` | |

**upsert로 구현할 것.** FCM 토큰은 앱 재설치·데이터 삭제·장기 미사용 시 갱신되므로, 같은 토큰이 반복 등록된다. 매번 새 행을 만들면 한 사용자에게 같은 알림이 여러 번 간다.

**토큰 소유권 이동 처리**: 기기를 물려주거나 다른 계정으로 로그인하면 같은 토큰이 다른 `user_id`로 등록된다. 이때 **기존 매핑을 덮어써야** 이전 사용자의 알림이 새 사용자에게 가지 않는다.

---

### R3. 알림 이벤트를 푸시로도 발송

기존 알림 이벤트 발생 지점에 FCM 발송을 추가한다. 대상 타입(`domain/notification/model/NotificationType.java`):

`SHARED_REQUEST`, `SHARED_APPROVE`, `SHARED_REJECTED`, `TRIP_UPDATED`, `TRIP_DELETED`, `MEDIA_FILE_ADDED`, `MEDIA_FILE_UPDATED`, `MEDIA_FILE_DELETED`

발송 지점: `domain/notification/event/`의 리스너들(`ShareNotificationEventListener`, `TripNotificationEventListener`, `MediaNotificationEventListener`).

**기존 STOMP 발송은 제거하지 않는다.** 앱이 켜져 있을 때는 STOMP 배너가 더 빠르고 자연스럽다. 푸시는 백그라운드·종료 상태를 메운다. 웹은 STOMP만 쓴다.

---

### R4. payload 규격 (FE가 이 형태를 파싱한다)

```json
{
  "notification": {
    "title": "새 공유 요청",
    "body": "OOO님이 여행을 공유했어요"
  },
  "data": {
    "type": "SHARED_REQUEST",
    "deeplink": "triptyche://trip/{tripKey}",
    "resourceId": "{tripKey 또는 notificationId}"
  }
}
```

- `data.deeplink`: 알림을 탭했을 때 이동할 화면. **없으면 앱은 홈으로 보낸다.**
- `data.type`: `NotificationType`의 값을 그대로 문자열로.
- `data`의 값은 **모두 문자열이어야 한다** (FCM 제약). 숫자를 넣으면 발송이 실패한다.

**딥링크 경로 매핑**

| 알림 | deeplink |
|---|---|
| `SHARED_*` | `triptyche://trip/{tripKey}` |
| `TRIP_*` | `triptyche://trip/{tripKey}` |
| `MEDIA_FILE_*` | `triptyche://trip/{tripKey}` |

현재는 모두 여행 상세로 보내면 충분하다. 세분화가 필요해지면 그때 확장한다.

---

### R5. 중복 방지 정책 (결정 필요)

앱이 **포그라운드**일 때 STOMP 배너와 푸시가 동시에 뜨면 같은 알림이 두 번 보인다.

**권장**: 서버는 **항상 둘 다 발송**하고, 앱이 포그라운드일 때 OS 알림을 억제한다.

이유는 서버가 "이 사용자가 지금 앱을 보고 있는가"를 정확히 알 수 없기 때문이다. WebSocket 세션이 살아 있어도 화면이 꺼져 있을 수 있고, 세션이 끊겼어도 앱은 떠 있을 수 있다. 서버가 추측해서 한쪽만 보내면 **알림이 아예 안 가는 경우**가 생기는데, 이는 중복보다 훨씬 나쁘다.

억제는 클라이언트가 확실히 판단할 수 있다(FE 담당, Phase 4-4).

---

### R6. 무효 토큰 정리

FCM 발송 시 다음 응답이 오면 해당 토큰을 **DB에서 삭제**한다.

- `UNREGISTERED` — 앱 삭제됨
- `INVALID_ARGUMENT` (등록 토큰 형식 오류)

정리하지 않으면 죽은 토큰이 쌓여 발송 비용과 실패율이 계속 오른다.

---

### R7. (선택) 알림 설정 API — P1

카테고리별 on/off가 필요하면:

```
GET  /v1/users/me/notification-settings
PUT  /v1/users/me/notification-settings
```

**출시 필수는 아니다.** 필요성이 확인된 뒤에 만든다.

---

## 작업 체크리스트

- [ ] Firebase 프로젝트 + Android 앱(`cloud.triptyche.app`) 등록
- [ ] 서비스 계정 키 발급 및 비밀 관리 (커밋 금지)
- [ ] `firebase-admin` 의존성 추가
- [ ] `device` 테이블/엔티티 (user 1:N, token unique)
- [ ] `POST /v1/devices` (upsert, 소유권 이동 처리)
- [ ] `DELETE /v1/devices/{token}`
- [ ] 알림 이벤트 리스너에 FCM 발송 추가 (STOMP는 유지)
- [ ] payload 규격 준수 — `data` 값은 전부 문자열
- [ ] 무효 토큰 자동 정리
- [ ] 발송 실패가 본 트랜잭션을 롤백시키지 않도록 분리 (`@Async` 등)

마지막 항목이 중요하다. **푸시 발송 실패 때문에 여행 공유 자체가 실패하면 안 된다.**

## 검증

```bash
# 1) 디바이스 등록
curl -X POST http://localhost:8080/v1/devices \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"token":"<FCM 토큰>","platform":"android","appVersion":"1.0.0"}'

# 2) 앱에서 FCM 토큰 확인 (FE가 로그로 출력)
adb logcat | grep -i "FCM"
```

**최종 확인**: 앱을 **완전 종료**한 뒤 다른 계정에서 공유 요청 → 기기에 알림 도착 → 탭하면 해당 여행 화면 진입.

에뮬레이터에서도 Google Play 이미지를 쓰면 FCM이 동작한다. Firebase 콘솔의 "테스트 메시지 보내기"로 백엔드 없이 먼저 확인할 수 있다.
