# 이미지 업로드 파이프라인 PRD v2 — Frontend

> **대상**: Frontend Claude Code (`triptyche-FE` 레포)
> **저장 위치**: `doc/refactoring/image-upload/PRD-frontend.md`
> **선행 문서**: `PRD-backend.md` (반드시 먼저 읽기)
>
> **v1 대비 변경**: BE 실제 구현 검증 후 갱신. API 경로/페이로드/LEGACY 상태 처리/EXIF 흐름 명확화.

---

## 0. 메타정보

### 0.1 목적
BE가 비동기로 이미지를 처리하는 동안 **사용자가 단 한 번도 404를 보지 않도록** FE를 재설계.

### 0.2 핵심 원칙
1. **API 재호출 없이 STOMP 이벤트만으로 src 교체** (사용자 모르게)
2. **`Image.decode()`로 디코딩 완료 확인 후 src 변경** (깜빡임 0)
3. **STOMP 손실 인정 + 페이지 진입 시 REST 동기화로 안전망**
4. **장당 STOMP 이벤트 받되 FE에서 100ms throttle로 batch update** (BE 단순 + UX 부드러움)
5. **LEGACY row (기존 v1 흐름)는 SwappableImage 적용 안 함** — currentUrl = finalUrl = mediaLink

### 0.3 작업 전 확인 사항
- 기존 레포(`triptyche-FE`)의 이미지 업로드 페이지 컴포넌트 위치 파악
- 기존 STOMP 클라이언트 사용 패턴 확인 (`@stomp/stompjs` 사용 중)
- 기존 알림(`/topic/share-notifications/`) 구독 방식 — 동일 패턴 유지
- EXIF 추출 라이브러리 확인 (`piexifjs` 사용 중 — `src/libs/utils/exif.ts`)
- 상태 관리 라이브러리 (Zustand `^4.5.5`)

---

## 1. Backend가 제공하는 계약

### 1.1 데이터 모델 (FE 관점)

```typescript
type ProcessingStatus =
  | 'UPLOADED'      // FE PUT 완료, 워커 대기
  | 'PROCESSING'    // 워커 작업 중
  | 'PROCESSED'     // 완료, finalUrl 사용 가능
  | 'FAILED'        // 실패, currentUrl 유지 + reason 표시
  | 'LEGACY';       // 기존 v1 흐름, mediaLink만 사용

interface MediaFileItem {
  mediaFileId: number;
  currentUrl: string;
  finalUrl: string;
  status: ProcessingStatus;
  processedAt?: string | null;
  failureReason?: string | null;
}
```

### 1.2 API

| 메서드 | 경로 | 역할 |
|---|---|---|
| `POST` | `/v1/trips/{tripKey}/presigned-url` | S3 presigned URL 발급. 응답에 `mediaFileId`, `fileKey`, `tempKey`, `finalKey`, `presignedPutUrl` 포함 |
| `POST` | `/v1/trips/{tripKey}/media-files/processing` | FE가 S3 PUT 직후 EXIF 메타데이터와 함께 호출. 워커 트리거. 기존 `PATCH /images-uploaded`(Trip status 전이용)와 도메인이 달라 둘 다 호출 |
| `GET` | `/v1/trips/{tripKey}/media-files/upload-status` | 페이지 진입/재진입 시 전체 MediaFile 상태 동기화 |
| `PATCH` | `/v1/trips/{tripKey}/images-uploaded` | Trip 워크플로 status 전환 (DRAFT → IMAGES_UPLOADED). **유지** |

> **참고**: `/processing` 명칭은 기존 `PATCH /images-uploaded`(Trip 워크플로 전환)와의 혼동을 피하기 위해 선정됨. 두 엔드포인트는 도메인 레이어가 다르므로 둘 다 호출.

### 1.3 STOMP

- 토픽: `/topic/media-processed/{userId}`
- 권한: BE의 `StompTopicAuthInterceptor`가 검증
- 성공 페이로드: `{ mediaFileId: number, finalUrl: string, status: "PROCESSED", processedAt: string }`
- 실패 페이로드: `{ mediaFileId: number, status: "FAILED", failureReason: string }`

---

## 2. 컴포넌트 설계

### 2.1 SwappableImage

```typescript
interface SwappableImageProps {
  mediaFileId: number;
  currentUrl: string;
  finalUrl: string;
  status: ProcessingStatus;
  alt?: string;
  className?: string;
}
```

상태 분기:
- `status === 'LEGACY'`: 단순 `<img src={currentUrl}>` early return. 스왑 로직 전혀 없음.
- `status === 'PROCESSED'`: `new Image()` + `.decode()` 후 `src` 교체
- `status === 'UPLOADED' | 'PROCESSING'`: `<img src={currentUrl}>` + 진행 표시
- `status === 'FAILED'`: `<FailedImageCard>` 렌더

### 2.2 FailedImageCard

```typescript
interface FailedImageCardProps {
  failureReason: string | null;
  onRetry: () => void;
}
```

- `translateFailureReason(failureReason)` 결과를 한국어 메시지로 표시
- 재시도 버튼 제공

---

## 3. 상태 관리

### 3.1 useUploadSessionStore (Zustand)

```typescript
interface UploadSessionState {
  tripKey: string | null;
  images: Record<number, MediaFileItem>;  // mediaFileId → MediaFileItem (O(1) 조회 필수)
  totalCount: number;
  processedCount: number;
  failedCount: number;

  syncImages(items: MediaFileItem[]): void;
  batchMarkProcessed(events: ProcessedEvent[]): void;
  markFailed(events: FailedEvent[]): void;
  reset(): void;
}
```

- `images`는 반드시 `Record<number, MediaFileItem>` — 배열 인덱스 절대 사용 금지
- `batchMarkProcessed`는 ProcessedEventBuffer에서 100ms 윈도우로 모아진 이벤트를 한 번에 적용

### 3.2 selectDisplayUrl

```typescript
function selectDisplayUrl(item: MediaFileItem): string
```

| status | 반환값 |
|---|---|
| `LEGACY` | `currentUrl` |
| `UPLOADED` | `currentUrl` |
| `PROCESSING` | `currentUrl` |
| `PROCESSED` | `finalUrl` |
| `FAILED` | `currentUrl` |

---

## 4. 업로드 흐름

```
사용자 파일 선택
  → presigned-url POST (mediaFileId, presignedPutUrl 수신)
  → S3 PUT (binary)
  → POST /media-files/processing (EXIF 포함)
      body: { items: [{ mediaFileId, recordDate, latitude, longitude }] }
      응답: { items: [{ mediaFileId, currentUrl, finalUrl, status: 'UPLOADED' }] }
  → useUploadSessionStore.syncImages(응답 items) — 초기 상태 설정
  → (백그라운드) STOMP 이벤트 수신 → ProcessedEventBuffer → batchMarkProcessed
  → SwappableImage가 PROCESSED 전이 감지 → decode() → src 교체
  → 사용자 입력 완료 → PATCH /images-uploaded (Trip 워크플로)
```

---

## 5. STOMP 라이프사이클

### 5.1 useStompTopic

```typescript
function useStompTopic<T>(
  topic: string,
  handler: (payload: T) => void,
  options?: { enabled?: boolean }
): void
```

- mount 시 `client.subscribe(topic, ...)` 호출
- `client.connected === false`이면 `onConnect` 콜백 큐에 추가
- unmount 시 `subscription.unsubscribe()`
- 내부에서 `src/libs/socket.ts` 싱글톤 client 사용

### 5.2 useUploadSessionSync

race condition 방지 순서:
1. STOMP 구독 먼저 (`useStompTopic` mount)
2. 구독 완료 후 `GET /upload-status` 호출
3. 응답 적용 전까지 도착한 STOMP 이벤트는 `pendingEvents` 버퍼에 보관
4. REST 응답 적용 후 `pendingEvents` 순서대로 replay
5. 이후 ProcessedEventBuffer 100ms 모드로 전환
6. WebSocket 재연결 시 `/upload-status` 재호출

---

## 6. ProcessedEventBuffer

```typescript
class ProcessedEventBuffer {
  constructor(windowMs: number, onFlush: (events: ProcessedEvent[]) => void)
  push(event: ProcessedEvent): void
  destroy(): void
}
```

- 100ms 윈도우 내 이벤트 누적 후 `onFlush` 한 번 호출
- 동일 `mediaFileId` 중복 수신 시 마지막 이벤트만 유지 (멱등)
- `destroy()` 시 pending timer 정리

---

## 7. DecodeQueue

```typescript
class DecodeQueue {
  constructor(concurrency: number)  // 기본 4
  add(task: () => Promise<void>): void
}
```

- 동시 실행 최대 `concurrency`개 제한
- task 실패 시 해당 task만 버리고 다음 task 계속 실행 (큐 차단 없음)
- module-level singleton으로 사용 (`SwappableImage`에서 import)

---

## 8. 에러 처리

### 8.1 decode() 실패
- `decode()` 실패 또는 미지원 환경 → `onload` 폴백
- `onload`도 실패 시 `currentUrl` 유지 (절대 화면을 비우지 않음)
- 콘솔 경고 출력

### 8.2 translateFailureReason

```typescript
function translateFailureReason(reason: string | null): string
```

| reason 원문 | 표시 메시지 |
|---|---|
| `'CORRUPTED'` | `'손상된 파일입니다'` |
| `'UNSUPPORTED_FORMAT'` | `'지원하지 않는 형식입니다'` |
| `'FILE_TOO_LARGE'` | `'파일이 너무 큽니다'` |
| `null` / 기타 | `'처리에 실패했습니다'` |

FAILED reason 원문을 절대 사용자에게 노출하지 않음.

---

## 9. 성능 가드레일

- ProcessedEventBuffer 100ms throttle 필수 — throttle 없이 dispatch 금지
- DecodeQueue concurrency=4 — 무한 동시 decode 금지
- `images` Record는 `Record<number, MediaFileItem>` O(1) 조회 — 배열 순회 금지
- STOMP 구독은 페이지 unmount 시 반드시 unsubscribe

---

## 10. 테스트 계획

### 10.1 단위 테스트 (Vitest)

| 대상 | 케이스 |
|---|---|
| `ProcessedEventBuffer` | 100ms 윈도우 합치기 / 중복 mediaFileId 멱등 / destroy 시 timer 정리 |
| `DecodeQueue` | concurrency=4 동시성 제한 / 실패 task가 큐 차단하지 않음 / 모든 task 완료 |
| `selectDisplayUrl` | 5종 status 모두 정확한 URL 반환 |
| `translateFailureReason` | corrupted / format / size / null 케이스 |

### 10.2 통합 테스트

- `SwappableImage`: PROCESSED 전이 시 swap / LEGACY 분기 (스왑 없음) / decode 실패 fallback
- `useUploadSessionStore`: 액션별 state 변경 / 동기화 후 stale 이벤트 무시

---

## 11. 구현 순서 (Phase)

| Phase | 내용 | BE 의존 |
|---|---|---|
| 0 — 인프라 | Vitest 도입, PRD 저장 | 없음 |
| 1 — 순수 유틸 + 타입 | ProcessingStatus 타입, 4종 유틸, 단위 테스트 | 없음 |
| 2 — SwappableImage | SwappableImage, FailedImageCard | 없음 |
| 3 — STOMP 추상화 | useStompTopic, TOPIC.MEDIA_PROCESSED | 없음 |
| 4 — Store + 동기화 훅 | useUploadSessionStore, useUploadSessionSync, fetchUploadStatus | 없음 (API 미호출) |
| 5 — API 컷오버 | presigned 응답 확장, triggerMediaProcessing, UI 연결 | **BE Phase 3 동기 배포 필요** |
| 6 — 검증 + 모니터링 | 수동 QA, 에러 로그, Cypress 시나리오 | BE 완료 후 |

---

## 12. 가드레일 (절대 지킬 것)

- STOMP 이벤트 수신 즉시 `<img src>` 교체 금지 → 반드시 `Image.decode()` 후
- `decode()` 실패 시 화면 비우기 금지 → `currentUrl` 유지
- throttle 없이 100개 dispatch 금지 → 반드시 `ProcessedEventBuffer` 통과
- `mediaFileId`를 배열 인덱스로 사용 금지 → 반드시 `Record<number, ...>`
- `/upload-status` 응답 적용 전에 STOMP 이벤트 적용 금지 → race 방지 패턴 준수
- FAILED reason 원문 노출 금지 → `translateFailureReason` 거치기
- LEGACY에 SwappableImage 스왑 로직 실행 금지 → `status === 'LEGACY'` 분기로 차단

---

## 13. 영향받는 파일

### 기존 (수정)
- `src/libs/apis/media.ts`
- `src/libs/socket.ts`
- `src/shared/constants/socket.ts`
- `src/domains/media/types.ts`
- `src/domains/media/hooks/useImageUpload.ts`
- `src/domains/media/hooks/usePhotoUpload.ts`
- `src/domains/media/components/manage/PhotoGridCell.tsx`
- `src/pages/trip/management/TripImageUploadPage.tsx`
- `src/pages/trip/management/TripImageAddPage.tsx`

### 신규
- `src/domains/media/components/common/SwappableImage.tsx`
- `src/domains/media/components/upload/FailedImageCard.tsx`
- `src/domains/media/hooks/useUploadSessionSync.ts`
- `src/shared/hooks/useStompTopic.ts`
- `src/domains/media/utils/ProcessedEventBuffer.ts`
- `src/domains/media/utils/DecodeQueue.ts`
- `src/domains/media/utils/selectDisplayUrl.ts`
- `src/domains/media/utils/translateFailureReason.ts`
- `src/domains/media/stores/useUploadSessionStore.ts`
