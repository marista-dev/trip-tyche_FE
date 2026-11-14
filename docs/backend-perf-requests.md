# 백엔드 수정 요청 — 사진 로딩 성능

- 작성: 2026-11-14, 프론트(trip-tyche_FE) 성능 분석 결과
- 대상 저장소: `triptyche-backend` (Spring Boot API + `image-worker/main.py`)
- 이 문서를 읽는 사람: 백엔드 작업 세션. 아래 항목을 순서대로 구현하고, 각 항목의 "완료 조건"을 확인한 뒤 PR을 올린다.

## 배경

프론트 측정에서 사진이 늦게 뜨는 원인 중 프론트만으로는 고칠 수 없는 것이 세 가지 남았다.

1. **표지 하나를 위해 여행마다 사진 목록 전체를 받는다.** 지구본 티켓 링, 티켓 목록, 마이 페이지 통계가 모두 여행 N개에 대해 `GET /v1/trips/{tripKey}/media-files`를 N번 호출한다. 그리고 첫 번째 `mediaLink` 하나만 쓴다.
2. **표지가 1920px 원본 WebP다.** 워커는 긴 변 1920px WebP만 만든다. 티켓 표지는 최대 750px 폭으로 그리는데, 받는 파일은 그 6배 이상의 픽셀이다.
3. **사진 캐시 기간이 짧다.** Lighthouse에서 OCI 사진 응답의 캐시 기간이 짧다는 경고가 나왔다. 재방문 때 약 370KB를 다시 받았다. 워커가 `put_object`에 `CacheControl`을 넣지 않는다.

HEIC 원본 업로드는 이미 동작한다. 워커의 `register_heif_opener()`와 presign의 확장자 무제한 덕분이다. **이번에 HEIC 관련 수정은 하지 않는다.**

## 우선순위 요약

| # | 작업 | 효과 | 범위 |
|---|---|---|---|
| B1 | 여행 목록 응답에 `coverMediaLink`·`photoCount` 추가 | 지구본·티켓 목록의 요청 N개 → 0개 | API만 |
| B2 | 워커가 표지용 축소본(썸네일) 생성 | 표지 다운로드 크기를 수 배 줄임 | 워커 + API + DB 컬럼 |
| B3 | 사진 객체에 `Cache-Control` 지정 | 재방문 때 다시 받지 않음 | 워커 + 일회성 스크립트 |
| B4 | `GET /v1/users/me/stats` | 마이 페이지의 요청 N개 → 1개 | API만, 우선순위 낮음 |

B1과 B3은 서로 독립적이다. 먼저 해도 되고 PR을 따로 올려도 된다. B2는 B1의 응답에 `coverThumbnailLink`를 더하므로 B1 다음에 한다.

---

## B1. 여행 목록에 표지·사진 수 추가

### 현재 코드

- `domain/trip/facade/TripFacade.java`
  - `getTripsSummary()`: `view=summary`(지구본)는 `TripSummaryResponse(tripKey, tripTitle, country, startDate, endDate)`를 돌려준다.
  - `getTripsByUser()`: 기본값(티켓 목록)은 `TripDetailResponse(...)`를 돌려준다.
- `domain/media/service/MediaQueryService.getTripImages()` → `MediaFileRepository.findByTripTripId(tripId)`
  - **`ORDER BY`가 없다.** 그래서 프론트가 쓰는 `mediaFiles[0]`도 DB가 돌려주는 순서에 따라 정해지고, 순서는 보장되지 않는다.
- `MediaPresignService.issuePutUrls()`는 `mediaLink` 없이 행을 만든다. 워커 처리가 끝나야 `MediaProcessingService.applyProcessedResult()`가 `mediaLink`를 채운다. 따라서 업로드 중인 사진의 `mediaLink`는 `null`이다.

### 바꿀 것

1. `TripSummaryResponse`와 `TripDetailResponse`에 필드 두 개를 **끝에** 추가한다. 기존 필드 순서와 이름은 바꾸지 않는다.
   ```java
   String coverMediaLink,   // 표지 사진 URL. 처리 끝난 사진이 없으면 null
   long photoCount          // 이 여행의 media_file 행 수(처리 중인 사진 포함)
   ```
2. 표지는 다음 규칙으로 고른다. 여행마다 사진 1장이다.
   - 대상: `media_link IS NOT NULL`인 행(처리 완료).
   - 정렬:
     - 날짜 없음 기본값(`1980-01-01T00:00:00`)인 사진은 뒤로 보낸다.
     - 그다음 `record_date ASC`, 마지막으로 `media_file_id ASC` 순이다.
   - 이유: 여행의 첫 장면이 표지가 되고, 같은 데이터면 항상 같은 사진이 나온다.
3. `photoCount`는 지금 프론트가 쓰는 값(`mediaFiles.length`)과 같게 한다. **해당 여행의 `media_file` 전체 행 수**를 세며, 처리 중인 사진도 포함한다. 그래야 화면의 숫자가 바뀌지 않는다.
4. 쿼리는 **여행 목록 전체에 대해 한 번**만 실행한다. 여행마다 따로 조회하는 N+1을 피한다.
   - `MediaFileRepository`에 tripId 목록을 받는 조회를 추가한다. MySQL 8이므로 window 함수를 쓸 수 있다.
     ```sql
     -- 표지: 여행별 1행
     SELECT trip_id, media_link FROM (
       SELECT trip_id, media_link,
              ROW_NUMBER() OVER (
                PARTITION BY trip_id
                ORDER BY (record_date = '1980-01-01 00:00:00'), record_date, media_file_id
              ) AS rn
       FROM media_file
       WHERE trip_id IN (:tripIds) AND media_link IS NOT NULL
     ) t WHERE rn = 1;

     -- 사진 수
     SELECT trip_id, COUNT(*) FROM media_file WHERE trip_id IN (:tripIds) GROUP BY trip_id;
     ```
   - native query + 인터페이스 projection을 권장한다. JPQL로 쓸 수 있으면 그래도 된다.
   - 기존 인덱스 `idx_media_file_trip_id_record_date (trip_id, record_date)`를 탄다.
   - `getTripsSummary`와 `getTripsByUser`는 같은 조회를 공유한다. facade에서 `Map<Long, ...>`으로 받아 붙이며, `shareMap` 패턴과 같은 방식이다.
5. **바꾸지 않을 것**: `findByTripTripId`의 정렬. 이 목록은 사진 관리·추정 화면이 그대로 쓰므로 순서를 바꾸면 영향 범위가 커진다.

### 완료 조건

- `./gradlew test`가 통과해야 한다. `TripFacade` 테스트에는 다음 경우를 넣는다.
  - 사진 0장
  - 처리 중 사진만 있는 경우(`cover=null`, `count>0`)
  - 1980 기본 날짜 사진이 가장 앞에 있는 경우(표지로 뽑히지 않아야 함)
  - 여행 여러 개(쿼리 2회로 끝나는지)
- 로컬에서 `GET /v1/trips?view=summary`와 `GET /v1/trips`의 응답에 두 필드가 있어야 한다.
- 호환성: 필드 추가만 하므로 기존 앱(1.0.5)은 영향을 받지 않는다. 프론트는 이 필드를 무시하고 있다.

### 프론트 후속 작업 (백엔드 배포 후 프론트 세션이 진행)

- `useTicketRingCovers`를 제거하고, 지구본 링이 summary의 `coverMediaLink`와 `photoCount`를 쓰게 바꾼다.
- `TripTicket`의 표지가 `useTripImages(tripKey)`(사진 전체) 대신 목록의 `coverMediaLink`를 쓰게 바꾼다.

---

## B2. 표지용 축소본(썸네일)

### 현재 코드

- `image-worker/main.py`
  - `resize_and_convert()`: 긴 변 1920px(`MAX_IMAGE_SIZE`), WebP 품질 85로 변환한다.
  - `process_message_v2()`: `tempKey`를 읽어 변환한 뒤 `finalKey`(`processed/{tripId}/{uuid}.webp`)에 PUT한다. 결과는 `media-processed-stream`에 `mediaFileId, finalKey, processedAt`으로 발행한다.
  - v1 흐름(`process_message`, `originals/` 키)은 레거시다. **v1에는 썸네일을 추가하지 않는다.**
- `global/redis/MediaProcessedStreamConsumer` → `MediaProcessingService.applyProcessedResult(mediaFileId, finalKey, processedAt)`
- 삭제 경로 세 곳이 모두 `mediaKey` 목록만 지운다.
  - `media/event/MediaFileS3DeleteEventListener`
  - `trip/scheduler/TripCleanupScheduler`
  - `guest/scheduler/GuestCleanupScheduler`

### 바꿀 것

1. **워커**: v2에서 원본을 한 번만 디코딩해 두 벌을 만든다.
   - 기존 본: 긴 변 1920px, 품질 85, `finalKey`. 지금과 같다.
   - 썸네일: **짧은 변 800px**(원본이 더 작으면 키우지 않음), 품질 80.
     - 키: `S3KeyResolver.swapTempToFinalKey`와 같은 규칙으로 `processed/{tripId}/{uuid}_thumb.webp`.
     - 짧은 변 기준인 이유: 프론트는 표지를 카드 비율에 맞게 잘라(cover crop) 최대 750px 폭으로 그린다. 긴 변 기준으로 줄이면 세로 사진의 폭이 750px보다 작아진다.
   - `exif_transpose`와 `convert("RGB")`는 한 번만 하고 두 출력에 같이 쓴다. 48MP 사진이 있으므로 디코딩을 두 번 하지 않는다.
   - 결과 메시지에 `thumbKey` 필드를 추가한다. 썸네일 PUT이 실패하면 `thumbKey` 없이 성공으로 발행한다. 썸네일은 보조 자료이므로 본 처리를 실패시키지 않는다.
2. **DB**: `media_file`에 `thumbnail_key VARCHAR(255) NULL` 컬럼을 추가한다.
   - 엔티티 `MediaFile`에 `thumbnailKey` 필드를 둔다. 상태 변경은 도메인 메서드로 한다(`@Setter` 금지, CLAUDE.md 규칙).
   - 운영 프로필은 `ddl-auto: validate`다. 그래서 `database/migration/`에 ALTER SQL을 추가하고, **API 배포 전에 운영 DB에 먼저 적용해야 한다.** 그러지 않으면 API가 시작되지 않는다. 형식은 그 디렉터리의 기존 파일을 따른다.
3. **API**
   - `MediaProcessedStreamConsumer`가 `thumbKey`를 읽는다. `applyProcessedResult`는 값이 있으면 엔티티에 저장한다.
   - B1의 두 응답에 `String coverThumbnailLink`를 추가한다. 표지 행의 `thumbnail_key`가 있으면 `S3KeyResolver.buildUrl(thumbnailKey)`로 URL을 만들고, 없으면 `null`이다.
   - `MediaFileResponse`(사진 목록)에도 `String thumbnailLink`를 끝에 추가한다. 사진 관리 그리드에서 쓸 수 있다.
4. **삭제**: 세 삭제 경로 모두 `mediaKey`와 함께 `thumbnailKey`(null이 아닐 때)도 지운다. 빠뜨리면 버킷에 고아 객체가 쌓인다.
5. **기존 사진(선택)**: 이미 처리된 사진의 썸네일을 만드는 일회성 스크립트. `processed/` 본을 읽어 썸네일을 만들고 `thumbnail_key`를 채운다. 프론트는 `thumbnailLink ?? mediaLink`로 대체하므로 하지 않아도 화면은 깨지지 않는다.

### 완료 조건

- 로컬 worker로 JPEG와 HEIC를 각각 1장 업로드한다.
  - `processed/{tripId}/{uuid}.webp`와 `_thumb.webp`가 모두 생겨야 한다.
  - 썸네일의 짧은 변이 800px이어야 한다(원본이 그보다 작으면 원본 크기).
  - 회전이 반영돼 있어야 한다.
- `media_file.thumbnail_key`가 채워지고, 목록 API에 `coverThumbnailLink`와 `thumbnailLink`가 나와야 한다.
- 사진을 삭제하면 두 객체가 모두 지워져야 한다.
- 썸네일 PUT을 강제로 실패시켜도 사진은 `PROCESSED`가 되고 `thumbnail_key`는 `null`이어야 한다.

### 프론트 후속 작업

- 지구본 표지와 티켓 목록 표지가 `coverThumbnailLink ?? coverMediaLink`를 쓰게 바꾼다.
- 사진 관리 그리드는 `thumbnailLink ?? mediaLink`를 쓰게 바꾼다.

---

## B3. 사진 객체 캐시 기간

### 현재 코드

워커의 `s3.put_object(...)` 두 곳(v1, v2)에 `CacheControl`이 없다. 객체 키에 UUID가 들어 있어 내용이 바뀌지 않는다. 재처리하더라도 같은 원본에서 같은 결과가 나온다. 따라서 오래 캐시해도 안전하다.

### 바꿀 것

1. 워커의 모든 `put_object`(B2의 썸네일 포함)에 `CacheControl="public, max-age=31536000, immutable"`를 넣는다.
2. 기존 객체에 적용할 일회성 스크립트를 만든다.
   - `processed/`와 `images/` 아래 객체를 자기 자신에게 복사한다(`copy_object` + `MetadataDirective="REPLACE"`).
   - 이때 `ContentType="image/webp"`를 반드시 다시 지정한다. REPLACE를 쓰면 기존 메타데이터가 사라진다.
   - 먼저 객체 하나로 시험한 뒤 전체를 돌린다.
3. **먼저 확인할 것**: OCI Object Storage의 S3 호환 API가 `Cache-Control`을 저장하고 GET 응답에 돌려주는지 확인한다.
   - 확인 방법: 객체 하나를 업로드한 뒤 `curl -sI <mediaLink> | grep -i cache-control`.
   - 돌려주지 않으면 이 항목은 중단하고 결과만 기록한다. 그 경우 대안은 CDN 앞단 설정이며, 별도로 논의한다.
4. CORS 설정은 바꾸지 않는다. 프론트는 `fetch()`로 표지를 받아 `createImageBitmap`으로 디코딩하므로 지금의 CORS 허용이 유지돼야 한다.

### 완료 조건

- 새로 업로드한 사진의 GET 응답 헤더에 `Cache-Control: public, max-age=31536000, immutable`가 있어야 한다.
- 스크립트를 돌린 기존 사진도 같은 헤더가 있고, `Content-Type: image/webp`가 유지돼야 한다.
- 프론트 사진 화면이 정상으로 떠야 한다(CORS 회귀 없음).

---

## B4. 마이 페이지 통계 API (우선순위 낮음)

`domains/user/hooks/useUserStats.ts`가 여행마다 사진 목록을 받아 브라우저에서 집계한다. 여행이 많을수록 느려진다.

- `GET /v1/users/me/stats`를 추가한다. 응답은 프론트 타입 `UserStats`(`src/domains/user/utils/stats.ts`)와 같은 모양이다.
  ```
  tripsCount, totalPhotos, locatedPhotos, unlocatedPhotos, countriesCount,
  mostPhotographedDay { date: 'YYYY-MM-DD', count, label } | null,
  byTrip   [{ tripKey, tripTitle, startDate, endDate, photoCount }]          // photoCount 내림차순
  byCountry[{ country, emoji, name, visits, photoCount }]                    // photoCount 내림차순
  ```
- 집계 규칙은 `aggregateUserStats()`를 그대로 옮긴다. 특히 다음 세 가지가 중요하다.
  - 위치 있음: `hasValidLocation`, 즉 (0,0)이 아닌 좌표.
  - 날짜 없음(1980-01-01)은 일별 집계에서 뺀다.
  - 국가 키 규칙(`getCountryKey`): 국내 여행의 지역 접미사(`…/SOUTH KOREA/제주`)는 나라 단위로 묶는다. 이름에 '트립티케' 또는 'TRIP TYCHE'가 들어간 자리표시 국가는 집계에서 뺀다.
- 완료 조건: 같은 계정에서 API 결과와 지금 마이 페이지 숫자가 모두 같아야 한다.

---

## 이번 범위 밖 (참고)

- 알림 시트의 여행 제목·사진 수 표시(`NoticeBackupSheet`, `ShareRequestSheet`, `ShareResultSheet`의 TODO)는 성능과 무관하다. 별도로 요청한다.
- 업로드 전 기기에서 사진 줄이기는 프론트 작업이다. 백엔드 변경은 필요 없다.

## 작업 방식

- 항목마다 브랜치와 PR을 따로 만든다(예: `feat/trip-cover-summary`, `feat/worker-thumbnail`, `chore/media-cache-control`).
- 운영 배포 순서: **DB 마이그레이션(B2) → API(필드 추가) → 워커**.
  - 워커가 먼저 `thumbKey`를 보내도 지금의 consumer는 그 필드를 무시하므로 깨지지는 않는다. 다만 API를 먼저 배포해야 썸네일 키가 저장된다.
- 배포가 끝나면 프론트 세션에 알린다. 각 항목의 "프론트 후속 작업"을 진행한다.
