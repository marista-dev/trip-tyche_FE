# PRD — 사용자 통계 API (`GET /v1/users/me/stats`)

> 상태: 제안(Proposed) · 작성일 2026-05-31 · 대상 저장소: `triptyche-backend`
> 관련 FE: `src/domains/user/hooks/useUserStats.ts`, `src/domains/user/utils/stats.ts`, `src/pages/SettingPage.tsx`

## 1. 배경 / 문제

설정(마이) 페이지 재설계로 프로필 카드에 **여행 / 사진 / 국가** 통계가 노출되고, 각 통계를 탭하면 상세 바텀시트(여행 목록·사진 위치 분포·국가별 집계)가 열린다.

현재 백엔드에는 이 통계를 한 번에 주는 집계 엔드포인트가 없다. 그래서 FE는 임시로 다음과 같이 **클라이언트 집계(N+1)** 한다.

1. `GET /v1/trips` 로 여행 목록을 받고
2. 여행마다 `GET /v1/trips/{tripKey}/media-files` 를 병렬 호출해
3. 사진 총합 / GPS 유무 / 최다 촬영일 / 국가별·여행별 사진 수를 클라이언트에서 계산한다.

**문제점**

- 여행 수에 비례한 N+1 요청 → 여행이 많을수록 느리고 네트워크/서버 부하 증가.
- 전체 media payload(이미지 URL 등)를 받아 카운트만 쓰므로 전송량 낭비.
- 최다 촬영일/국가별 집계가 클라이언트 로직에 분산되어 일관성·테스트 비용 증가.

## 2. 목표

- 설정 페이지 통계에 필요한 값을 **단일 GET 요청**으로 제공한다.
- FE는 `useUserStats` 내부 구현만 교체하고, 반환 타입(`UserStats`)과 화면 컴포넌트는 변경하지 않는다.

## 3. 비목표

- 통계 캐싱/실시간 갱신 정책(소켓 등)은 본 PRD 범위 밖.
- 사진 단건 리스트 제공(기존 media-files 엔드포인트 유지).

## 4. API 명세 (제안)

```
GET /v1/users/me/stats
Authorization: 세션 쿠키 (@CurrentUser)
```

### 응답 스키마

```json
{
  "tripsCount": 12,
  "totalPhotoCount": 247,
  "locatedPhotoCount": 244,
  "unlocatedPhotoCount": 3,
  "mostPhotographedDay": {
    "date": "2024-03-14",
    "count": 52,
    "tripKey": "abc123",
    "country": "🇯🇵/일본/JAPAN"
  },
  "visitedCountriesCount": 5,
  "byCountry": [
    { "country": "🇯🇵/일본/JAPAN", "visits": 3, "photoCount": 436 },
    { "country": "🇰🇷/대한민국/SOUTH KOREA", "visits": 1, "photoCount": 128 }
  ],
  "byTrip": [
    {
      "tripKey": "abc123",
      "tripTitle": "도쿄 봄꽃 여행",
      "startDate": "2024-03-13",
      "endDate": "2024-03-15",
      "photoCount": 247
    }
  ]
}
```

### 필드 정의

| 필드 | 타입 | 설명 |
|---|---|---|
| `tripsCount` | number | CONFIRMED 여행 수 (기존 summary와 동일 기준) |
| `totalPhotoCount` | number | 사용자 전 여행 media 총합 |
| `locatedPhotoCount` | number | `latitude != null AND longitude != null` (0,0 제외 권장) |
| `unlocatedPhotoCount` | number | `totalPhotoCount - locatedPhotoCount` |
| `mostPhotographedDay` | object \| null | `recordDate` 날짜부 기준 최다 촬영일. 기본값(1980-01-01) 제외 |
| `visitedCountriesCount` | number | 플레이스홀더 제외 고유 `country` 수 |
| `byCountry[]` | array | `country` 문자열 그룹: 방문 횟수(여행 수)·사진 수, 사진 수 desc 정렬 |
| `byTrip[]` | array | 여행별 사진 수, 사진 수 desc 정렬 |

> `country`는 기존 저장 포맷 `"이모지/한글/영문"`을 그대로 내려준다(FE가 `split('/')`로 분해).
> 플레이스홀더(`👋/트립티케/TRIP TYCHE`, 빈 값)는 `byCountry`/`visitedCountriesCount`에서 제외한다.

## 5. 백엔드 구현 힌트

- 신규: `StatsController` (`GET /v1/users/me/stats`) + `UserStatsService`.
- `MediaFileRepository`에 집계 쿼리 추가(여행 단위 count, located count, 국가/일자 group-by). 가능하면 단일 조인 쿼리로 N+1 회피.
  - located 판정: `latitude IS NOT NULL AND longitude IS NOT NULL` (필요 시 `<> 0` 추가).
  - 국가 그룹: `Trip.country` 기준 그룹, media count 조인.
  - 최다 촬영일: `recordDate`의 date 캐스팅 group-by + max count.
- 참고 파일(현행):
  - `domain/user/controller/UserController.java`, `domain/user/service/UserService.java`, `domain/user/dto/UserSummaryResponse.java`
  - `domain/trip/repository/TripRepository.java` (`countByUserAndStatus`)
  - `domain/media/repository/MediaFileRepository.java`, `domain/media/model/MediaFile.java`

## 6. FE 교체 가이드

`src/domains/user/hooks/useUserStats.ts` 만 수정한다.

- 기존: `useTripTicketList` + `useQueries(media-files)` + `aggregateUserStats(...)`.
- 변경: `useQuery(['user-stats'], () => statsAPI.fetchUserStats())` 단일 호출 후 응답을 `UserStats`(`utils/stats.ts`)로 매핑.
- `UserStats` 타입과 `SettingPage` / `StatBottomSheet`는 **변경 없음**.
- 응답 필드명이 위 스키마와 같다면 매핑은 거의 1:1(`totalPhotoCount→totalPhotos`, `locatedPhotoCount→locatedPhotos`, `unlocatedPhotoCount→unlocatedPhotos`, `visitedCountriesCount→countriesCount`).

## 7. 수용 기준

- [ ] 단일 요청으로 위 모든 필드 반환.
- [ ] located/unlocated 합이 total과 일치.
- [ ] 플레이스홀더 국가 제외, `country` 원본 포맷 유지.
- [ ] 여행 0개 사용자도 200 + 0/빈 배열 반환(널 안전).
- [ ] FE는 `useUserStats` 내부만 교체해 화면 회귀 없음.
