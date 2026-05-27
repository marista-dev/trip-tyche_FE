# PRD — WebSocket Banner v2 백엔드 변경 요청

> **상태**: Draft · 2026-05-26
> **연관 FE 작업**: `feat(notification): WS 메시지 UI를 Apple Live Activity 스타일 In-App Banner로 통합` (`commit 58f8a49`)
> **연관 코드**:
> - FE: [`src/domains/notification/banner/`](../src/domains/notification/banner/), [`src/libs/socket.ts`](../src/libs/socket.ts)
> - BE: `triptyche-backend/src/main/java/com/triptyche/backend/domain/notification/event/`

---

## 1. 배경

In-App Banner v1을 출시했다(상단 liquid-glass 배너, 8가지 WS 타입 통합). v1은 의도적으로 백엔드 변경 없이 마이그레이션했고, 두 가지 UX 한계를 안고 있다:

| # | 한계 | 사용자 영향 | 원인 |
|---|---|---|---|
| 1 | SHARED_REQUEST의 "참여하기" / "거절" 버튼이 알림 페이지로 **이동**할 뿐 | 두 번 클릭(배너 탭 → 알림 페이지 → 다시 확정). 보딩패스 확장 UX가 무력화됨 | WS payload에 `shareId`가 없어 인라인 API 호출 불가 |
| 2 | SHARED_APPROVE 배너에 닉네임이 `undefined`로 표시 | "undefined님과 여행 메이트가 됐어요" — 누가 수락했는지 알 수 없음 | WS payload에 `senderNickname` 필드 자체가 없음 (DB엔 저장되지만 push 시 누락) |

본 PRD는 위 두 한계를 해결하기 위한 **백엔드 payload 보강**과, 추가로 발견된 데이터 갭(`count` 일관성, 누락 케이스 fallback)을 한꺼번에 정리한다.

---

## 2. 현재 Payload 실측 (백엔드 코드 검증)

`/topic/share-notifications/{userId}`로 push되는 payload는 `NotificationSavedEvent.payload()` (Map<String, Object>)를 그대로 직렬화한 것이다 — [`NotificationWebSocketListener.java:L22-25`](../../triptyche-backend/src/main/java/com/triptyche/backend/domain/notification/event/NotificationWebSocketListener.java). 가공 단계가 없으므로 **각 EventListener가 채우는 Map이 곧 FE가 받는 JSON**이다.

| Type | 필드 (실측) | referenceId(DB) | 비고 |
|---|---|---|---|
| `SHARED_REQUEST` | `type`, `senderNickname`, `tripTitle` | `Share.id` | ❌ shareId가 payload에 없음 |
| `SHARED_APPROVE` | `type`, `recipientId` | `Share.id` | ❌ `senderNickname` 누락 |
| `SHARED_REJECTED` | `type`, `recipientId` | `Share.id` | ❌ `senderNickname` 누락 |
| `TRIP_UPDATED` | `type`, `recipientId`, `tripKey`, `tripTitle`, `senderNickname` | `Trip.id` | ✅ 정상 |
| `TRIP_DELETED` | `type`, `recipientId`, `tripTitle`, `senderNickname` | `Trip.id` | ⚠️ `tripKey` 없음 — 어차피 삭제됐으니 OK |
| `MEDIA_FILE_ADDED` | `type`, `recipientId`, `tripKey`, `tripTitle`, `senderNickname`, `count` | `Trip.id` | ✅ 정상 |
| `MEDIA_FILE_UPDATED` | `type`, `recipientId`, `tripKey`, `tripTitle`, `senderNickname`, `count` | `Trip.id` | ✅ 정상 |
| `MEDIA_FILE_DELETED` | `type`, `recipientId`, `tripKey`, `tripTitle`, `senderNickname`, `count` | `Trip.id` | ✅ 정상 |

> **확인 출처**:
> - `ShareNotificationEventListener.java` L25-39 (SHARED_REQUEST), L43-55 (SHARED_APPROVE), L57-71 (SHARED_REJECTED)
> - `TripNotificationEventListener.java` L46-60, L65-81
> - `MediaNotificationEventListener.java` L30-42, L46-58, L78-90, L148-158
> - `ShareController.java` L50-56 — `PATCH /v1/shares/{shareId}?status={APPROVED|REJECTED}` (FE의 `useShareStatus` 시그니처와 일치)

---

## 3. 요청 사항

### 3.1 [P0] SHARED_REQUEST payload에 `shareId` 추가

**Why**: 배너 인라인 수락/거절 (`PATCH /v1/shares/{shareId}?status=...`)에 필요. 현재는 페이지 이동으로 우회 중이라 UX가 끊긴다.

**변경 위치**: `ShareNotificationEventListener.java` L25-39

**현재**:
```java
Map<String, Object> payload = new HashMap<>();
payload.put("type", "SHARED_REQUEST");
payload.put("senderNickname", event.senderNickname());
payload.put("tripTitle", event.tripTitle());
```

**변경 후**:
```java
Map<String, Object> payload = new HashMap<>();
payload.put("type", "SHARED_REQUEST");
payload.put("shareId", event.shareId());        // NEW
payload.put("senderNickname", event.senderNickname());
payload.put("tripTitle", event.tripTitle());
```

**FE에서 사용 방식 (변경 예고)**:
- `BannerMessage`에 `shareId?: number` 추가
- `WebSocketBanner.tsx`의 `handleAccept/handleReject` → `useShareStatus({ shareId, status })` 직접 호출
- 성공 시 배너 collapse + dismiss + `queryClient.invalidateQueries(['ticket-list', 'summary', 'notification'])`
- 실패 시 토스트 fallback ("초대 처리 중 문제가 발생했어요")

---

### 3.2 [P0] SHARED_APPROVE / SHARED_REJECTED payload에 `senderNickname` 추가

**Why**: 현재 배너에 "**undefined**님과 여행 메이트가 됐어요" 표시 — 가장 눈에 띄는 회귀 버그.

**변경 위치**:
- `ShareNotificationEventListener.java` L43-55 (SHARED_APPROVE)
- `ShareNotificationEventListener.java` L57-71 (SHARED_REJECTED)

**의미**: 수락/거절한 **상대방의 닉네임**. 즉 SHARED_REQUEST 송신자(Share 소유자) 입장에서 보면 "초대를 받은 사람의 닉네임" = `recipient.getUserNickName()`. 이 값은 이미 DB notification에 저장되고 있음 (`NotificationSender.java` L35).

**현재**:
```java
Map<String, Object> payload = new HashMap<>();
payload.put("type", "SHARED_APPROVE");
payload.put("recipientId", event.ownerId());
```

**변경 후**:
```java
Map<String, Object> payload = new HashMap<>();
payload.put("type", "SHARED_APPROVE");
payload.put("recipientId", event.ownerId());
payload.put("senderNickname", event.recipientNickname());  // NEW — 수락/거절자 닉네임
```

> `ShareApprovedEvent` / `ShareRejectedEvent`에 `recipientNickname` 필드가 없다면 함께 추가하고, `ShareService.updateShareStatus()` (L112-122)에서 `recipient.getUserNickName()`을 이벤트에 같이 전달.

**FE 영향 없음**: 기존 `senderNickname` 키를 그대로 읽으므로 추가 변경 불필요.

---

### 3.3 [P1] SHARED_APPROVE payload에 `tripKey` + `tripTitle` 추가

**Why**: 현재 SHARED_APPROVE는 알림 본문이 "메이트가 됐어요"만 나오고 어떤 여행인지 알 수 없음. 배너 탭 시 `/tickets` 일반 목록으로만 이동(specific trip으로 점프 불가).

**제안**: payload에 다음 추가
- `tripKey` (String): 수락된 share의 trip 식별자
- `tripTitle` (String): 어떤 여행인지 본문에 노출

**FE 변경 예고**:
- 본문: `{senderNickname}님이 "{tripTitle}" 메이트가 됐어요`
- 탭 시 `navigate(ROUTES.PATH.TRIP.ROOT(tripKey))` (현재 `/tickets`)

**우선순위**: P1 — UX 개선이지만 v1 critical bug는 아님. 3.1/3.2와 함께 처리하는 게 효율적.

---

### 3.4 [P2] FE에서 `count`를 본문에 노출 (BE 변경 없음)

**Why**: 디자인 명세는 "N장의 사진을 추가했어요"인데 v1은 단순화하여 "사진을 추가했어요"로 표시 중. 백엔드는 이미 `count`를 보내고 있음.

**변경 위치**: `src/domains/notification/banner/constants.ts` `buildBannerBody()`

**변경 예고**:
```ts
case 'MEDIA_FILE_ADDED':
    return msg.count
        ? `${sender}님이 사진 ${msg.count}장을 추가했어요`
        : `${sender}님이 사진을 추가했어요`;
// UPDATED/DELETED도 동일 패턴
```

**우선순위**: P2 — BE 변경 불필요. FE 단독 후속 작업.

---

### 3.5 [P2] 모든 payload에 `notificationId` 추가 (관측성/멱등성)

**Why**: 동일 알림이 재연결 시 재전송될 수 있음 (STOMP at-least-once). FE가 dedup하려면 식별자 필요. 또한 배너에서 "읽음 처리"를 인라인으로 하려면 notification PK 필요.

**제안**: payload에 `notificationId` (Notification 엔티티 PK) 추가.

**구현 노트**: `NotificationSavedEvent`는 이미 `notificationId`를 추출할 수 있음. EventListener에서 `payload.put("notificationId", saved.getId())` 한 줄 추가.

---

## 4. 페이로드 스키마 (목표 상태)

변경 후 각 타입이 가져야 할 **표준 스키마**:

```ts
// 공통
{
  type: BannerType;            // discriminator
  notificationId: number;      // [3.5] 모든 타입
  senderNickname: string;      // [3.2] 모든 타입에 존재
}

// 타입별 추가 필드
SHARED_REQUEST:   { shareId: number, tripTitle: string }     // [3.1]
SHARED_APPROVE:   { shareId: number, tripKey: string, tripTitle: string }  // [3.3]
SHARED_REJECTED:  { shareId: number, tripTitle: string }
TRIP_UPDATED:     { tripKey: string, tripTitle: string }     // 현재 OK
TRIP_DELETED:     { tripTitle: string }                       // 현재 OK
MEDIA_FILE_*:     { tripKey: string, tripTitle: string, count: number }  // 현재 OK
```

---

## 5. 마이그레이션 / 호환성

- 모든 변경은 **필드 추가**만 (기존 필드 제거/이름 변경 없음) → FE v1과 forward-compat
- FE는 새 필드를 모두 옵셔널로 받음 (`shareId?`, `notificationId?` 등) → BE 배포 전후 어느 시점에도 안전
- FE 배포 순서: BE 변경 → 배포 → FE에서 새 필드 사용하는 코드 활성화
- 데이터 마이그레이션 필요 없음 (실시간 push만 영향)

---

## 6. 검수 (BE 측에서 확인할 것)

각 변경 항목에 대해 다음을 확인:

- [ ] SHARED_REQUEST 발송 시 payload JSON에 `shareId` 존재 (브라우저 DevTools → WS frame 확인)
- [ ] SHARED_APPROVE 발송 시 payload JSON에 `senderNickname` 존재 + 값이 수락자 닉네임과 일치
- [ ] SHARED_REJECTED 동일
- [ ] SHARED_APPROVE payload에 `tripKey`, `tripTitle` 존재 + 실제 trip과 일치
- [ ] 모든 알림 payload에 `notificationId` 존재
- [ ] 기존 FE v1 (배너)가 변경 후에도 깨지지 않음 (forward-compat 검증)
- [ ] `PATCH /v1/shares/{shareId}?status=APPROVED` 호출 시 → 본인의 share 목록 / Trip 메이트 목록에 정상 반영

---

## 7. FE 후속 작업 (BE 변경 완료 후)

본 PRD 항목이 백엔드에 반영되면 FE에서 이어 진행할 작업:

1. `BannerMessage` 타입에 `shareId?`, `notificationId?`, `tripKey?`(SHARED_APPROVE용), `count?` 추가
2. `socket.ts`에서 새 필드 모두 store로 전달
3. `WebSocketBanner.tsx`의 `handleAccept/handleReject`:
   - `useShareStatus.mutate({ shareId, status })` 인라인 호출
   - 성공 시 collapse + dismiss + invalidate
   - 실패 시 토스트 fallback
4. SHARED_APPROVE 본문/탭 동작에 `tripTitle`/`tripKey` 활용
5. `buildBannerBody()`에 `count` 반영
6. (선택) `notificationId` 기반 dedup — `useBannerStore.show()`에서 같은 `notificationId`가 큐에 이미 있으면 무시

---

## 8. 비-목표 (Out of Scope)

- NOTICE_INCOMPLETE / NOTICE_FEATURE / NOTICE_BACKUP의 WebSocket 지원 추가
- 알림 읽음 처리의 WS push (현재 폴링 기반 유지)
- 알림 그룹화 ("OO님과 외 2명이 사진을 추가했어요" 같은 묶음) — 별도 PRD

---

## 9. 변경 요청 요약 (BE 측 작업 단위)

| 우선순위 | 항목 | 파일 | 작업량 |
|---|---|---|---|
| P0 | SHARED_REQUEST에 `shareId` 추가 | `ShareNotificationEventListener.java` | 1줄 |
| P0 | SHARED_APPROVE에 `senderNickname` 추가 | `ShareNotificationEventListener.java`, `ShareApprovedEvent.java`, `ShareService.java` | ~5줄 |
| P0 | SHARED_REJECTED에 `senderNickname` 추가 | `ShareNotificationEventListener.java`, `ShareRejectedEvent.java`, `ShareService.java` | ~5줄 |
| P1 | SHARED_APPROVE에 `tripKey`, `tripTitle` 추가 | `ShareNotificationEventListener.java`, `ShareApprovedEvent.java`, `ShareService.java` | ~5줄 |
| P2 | 모든 타입에 `notificationId` 추가 | EventListener 3종 | ~3줄 |

**예상 백엔드 작업량**: 1~2시간 (이벤트 record 필드 추가 + EventListener payload 채움 + 단위테스트 갱신).
