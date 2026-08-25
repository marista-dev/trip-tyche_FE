# 푸시 — M2 결과

> 상위: [README](README.md) · BE `feature/m2-push` · **PR 대기 (머지 전에는 호출해도 404)**

## 1. 디바이스 토큰 등록 · 해제

```
POST /v1/devices                     인증: 필요 (Bearer)
{ "token": "<FCM 토큰>", "platform": "android", "appVersion": "1.0.0" }
→ 200

DELETE /v1/devices/{token}           인증: 필요 (Bearer)
→ 200
```

- `platform`은 **대소문자를 가리지 않는다.** `"android"` 소문자 그대로 보내도 되고 `"ANDROID"`도 된다
- `appVersion`은 선택. 없으면 `null`로 저장된다
- 응답 body는 쓰지 않는다

**서버가 upsert로 처리한다.** 같은 토큰을 반복 등록해도 행이 늘지 않는다.
FCM 토큰은 앱 재설치·데이터 삭제·장기 미사용 시 갱신되므로 **앱을 켤 때마다 등록해도 안전하다.**

같은 토큰이 다른 계정으로 오면 서버가 소유권을 옮긴다. 기기를 물려주거나 계정을 바꿔 로그인해도 이전 사용자에게 알림이 가지 않는다.

### ⚠️ 등록 시점을 로그인 이후로 옮길 것

인증이 필요한 API다. 현재 `push.ts`는 `initAppShell()`에서 호출되는데, **로그인 전이면 401**이 난다.

```ts
// 지금 (appShell.ts) — 토큰 발급까지만 하고 서버 전송은 없음
void setupPushNotifications();
```

토큰 발급 자체는 인증과 무관하므로 지금 위치도 문제는 없다.
다만 **서버 전송을 붙일 때는** 로그인 성공 직후로 옮기거나, `registration` 리스너 안에서 인증 상태를 확인해야 한다.

### 로그아웃 시

`DELETE /v1/devices/{token}`을 호출한다. 안 하면 로그아웃한 기기로 계속 알림이 간다.
호출 순서는 **디바이스 해제 → 로그아웃**이다. 로그아웃 후에는 Bearer 토큰이 없어 401이 난다.

---

## 2. 서버가 보내는 payload

```json
{
  "notification": { "title": "새 공유 요청", "body": "마리스타님이 '뉴욕 가을 여행' 여행을 공유했어요" },
  "data": {
    "type": "SHARED_REQUEST",
    "deeplink": "triptyche://trip/{tripKey}",
    "resourceId": "{tripKey 또는 notificationId}"
  }
}
```

`data`의 값은 **전부 문자열**이다 (FCM 제약). 숫자로 오는 필드는 없다.

### 알림 문구

서버가 타입별로 만들어 보낸다. FE에서 가공할 필요 없다.

| `type` | title | body |
|---|---|---|
| `SHARED_REQUEST` | 새 공유 요청 | OOO님이 '여행제목' 여행을 공유했어요 |
| `SHARED_APPROVE` | 공유 요청 수락 | OOO님이 '여행제목' 공유를 수락했어요 |
| `SHARED_REJECTED` | 공유 요청 거절 | OOO님이 '여행제목' 공유를 거절했어요 |
| `TRIP_UPDATED` | 여행 정보 변경 | OOO님이 '여행제목' 정보를 수정했어요 |
| `TRIP_DELETED` | 여행 삭제 | OOO님이 '여행제목' 여행을 삭제했어요 |
| `MEDIA_FILE_ADDED` | 사진 추가 | OOO님이 '여행제목'에 사진 N장을 추가했어요 |
| `MEDIA_FILE_UPDATED` | 사진 정보 변경 | OOO님이 '여행제목'의 사진 정보를 수정했어요 |
| `MEDIA_FILE_DELETED` | 사진 삭제 | OOO님이 '여행제목'에서 사진 N장을 삭제했어요 |

닉네임이 없으면 "누군가", 여행 제목이 없으면 "여행"으로 대체된다.

### `deeplink`가 없을 수 있다

서버가 알림 payload에서 `tripKey`를 못 구하면 **`deeplink` 키 자체를 넣지 않는다.**
그 경우 `resourceId`에는 `notificationId`가 들어간다.

**`deeplink`가 없으면 홈으로 보내면 된다.**

---

## 3. 알림 탭 시 화면 이동

```ts
await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const deeplink = notification.data?.deeplink;

    if (!deeplink) {
        window.location.replace('/');
        return;
    }

    // triptyche://trip/{tripKey} → /trip/{tripKey}
    const path = deeplink.replace('triptyche://', '/');
    window.location.replace(path);
});
```

앱이 **완전히 종료된 상태**에서 알림을 탭한 경우에도 이 리스너가 발화한다.
다만 `initAppShell()`이 끝나기 전일 수 있으니, 토큰 복원 이후에 이동하도록 순서에 주의한다.

---

## 4. ⚠️ 기본 알림 채널을 선언해야 한다

현재 미선언 상태다. 실기기 로그에서 확인됐다.

```
W FirebaseMessaging: Missing Default Notification Channel metadata in AndroidManifest.
                     Default value will be used.
```

Android 8+는 알림에 채널이 필요한데, 선언이 없어 시스템 기본값으로 떨어진다. 결과는 두 가지다.

- **중요도가 기본값이라 헤드업 배너가 안 뜰 수 있다**
- 사용자 설정 화면에 채널 이름이 "기타"로 보인다

```xml
<!-- android/app/src/main/AndroidManifest.xml — <application> 안 -->
<meta-data
    android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="triptyche_default" />
```

```ts
// push.ts — register() 전에
await PushNotifications.createChannel({
    id: 'triptyche_default',
    name: '여행 알림',
    importance: 5,   // MAX — 헤드업 배너
    visibility: 1,
});
```

---

## 5. 포그라운드에서는 OS 알림이 안 뜬다

Capacitor 기본 동작이다. 앱이 앞에 있으면 배너 대신 `pushNotificationReceived` 리스너만 발화한다.

**이건 버그가 아니라 우리가 원하는 동작이다.**

서버는 **STOMP와 푸시를 항상 둘 다 보낸다.** "이 사용자가 지금 앱을 보고 있는가"를 서버가 정확히 알 수 없기 때문이다(WebSocket 세션이 살아 있어도 화면이 꺼져 있을 수 있고, 세션이 끊겼어도 앱은 떠 있을 수 있다). 서버가 추측해서 한쪽만 보내면 **알림이 아예 안 가는 경우**가 생기는데, 이는 중복보다 훨씬 나쁘다.

중복 억제는 클라이언트가 확실히 판단할 수 있고, Capacitor가 이미 그렇게 해준다.
→ 앱이 켜져 있을 때는 기존 STOMP 배너, 백그라운드·종료 상태는 푸시.

**테스트할 때 앱을 켜둔 채로 하면 "알림이 안 온다"고 오진하기 쉽다.** 홈 버튼으로 내리거나 완전 종료하고 확인할 것.

---

## 6. Android 13+ 알림 권한

`POST_NOTIFICATIONS` 런타임 권한이 필요하다. `requestPermissions()`가 띄운다.

**거부돼도 토큰은 정상 발급되고 서버 발송도 성공으로 찍힌다. 기기에만 안 뜬다.**
원인을 찾기 어려운 조합이라 `push.ts`가 권한 결과를 로그로 남기고 있다.

---

## 7. 무효 토큰은 서버가 지운다

FCM이 `UNREGISTERED`(앱 삭제)를 반환하면 서버가 해당 행을 삭제한다.
FCM은 **270일 미사용 토큰을 자동 만료**시키므로(2024.5.15부터) 이 정리가 필요하다.

FE 입장에서 중요한 건 하나다 — **앱을 켤 때마다 토큰을 재등록**하면 서버가 지운 뒤에도 자동 복구된다.
upsert라 중복 걱정은 없다.
