# Phase 0 — 선행 정리 개선 계획

> 작성일: 2026-08-22 · 상위 문서: [`../app-capacitor-checklist.md`](../app-capacitor-checklist.md) Phase 0
> 대상: Capacitor 설치 **전에** 처리하는 플랫폼 무관 정리 작업

## 왜 지금 하는가

Phase 0은 앱 작업이 아니다. 하지만 여기서 정리해두지 않으면 이후 Capacitor 단계에서 **판단 근거가 흐려진다**.

| 항목 | 미루면 생기는 문제 |
|---|---|
| 01 미사용 의존성 | 앱 번들 크기를 측정해도 기준선이 부풀려져 있어 최적화 판단 불가 |
| 02 EXIF 촬영시각 | 실기기에서 "EXIF 추출 성공"을 검증할 때 **날짜가 틀린 채로 통과**시킴 |
| 03 메타데이터 메모리 | WebView는 브라우저보다 메모리 제약이 크다. 대량 업로드 OOM이 앱에서 먼저 터짐 |
| 04 Maps 앱 키 | 앱 빌드가 웹 키를 그대로 쓰면 키가 APK에 박힌 채 배포됨 (되돌리기 어려움) |

## 항목 문서

| # | 문서 | 한 줄 요약 | 성격 |
|---|---|---|---|
| 01 | [미사용 의존성 제거](01-remove-unused-deps.md) | `@deck.gl/*` 5종 + `browser-image-compression` 삭제 | 코드 |
| 02 | [EXIF 촬영시각 수정](02-exif-datetime-fix.md) | 저장시각 대신 `DateTimeOriginal`을 읽도록 수정 | 코드(버그) |
| 03 | [메타데이터 추출 개선](03-metadata-memory.md) | 파일당 base64 2회 읽기 → 1회, 동시성 상한 도입 | 코드(성능) |
| 04 | [Maps 앱 전용 키 분리](04-maps-api-key.md) | `--mode app` 빌드로 앱 전용 키 주입 | 인프라 |

## 실행 순서와 의존관계

```
01 (독립)  ─┐
04 (독립)  ─┤
            ├─→ Phase 1 (Capacitor 셸)
02 ──→ 03  ─┘
```

- **01, 04는 다른 항목과 무관** — 아무 때나, 병렬로 진행 가능
- **02 → 03 순서 권장**: 03이 `readExifData` 호출 구조를 바꾸므로, 02의 태그 수정을 먼저 넣어야 충돌이 없다. 반대로 하면 03에서 만든 구조 위에 02를 다시 얹어야 한다
- 04는 코드 변경이 없고 Google Cloud 콘솔 작업이 대부분이라 **리드타임이 있다** — 먼저 착수해두면 좋다

## 공통 검증

모든 항목에 공통으로 적용한다. 각 문서의 "검증" 절은 여기에 더해지는 항목만 기술한다.

```bash
npm run lint        # eslint
npm run test:run    # vitest 1회 실행
npm run build       # tsc -b && vite build
```

**테스트 작성 규약** (기존 7개 테스트에서 확인된 관행):
- 소스 옆에 병치 — `src/libs/utils/exif.ts` → `src/libs/utils/exif.test.ts`
- `globals: true`이지만 `import { describe, it, expect, vi } from 'vitest'`를 **명시적으로 import**
- vitest 설정은 별도 파일이 아니라 `vite.config.ts`의 `test` 블록에 인라인

**수동 회귀** (03·02는 자동 테스트로 안 잡히는 부분이 있다):
여행 생성 → 사진 여러 장 업로드 → 진행률 표시 정상 → 지도에 핀 생성 → 날짜별 그룹핑 확인

---

## 추가 발견 (Phase 0 범위 밖 — 기록용)

조사 중 발견했으나 이번 Phase 0에 포함하지 않기로 한 항목들. **잊지 않기 위해 기록만 남긴다.**

### A. HEIC 사진의 EXIF 손실 가능성

`prepareUploadFiles`([`useImageUpload.ts:97-101`](../../src/domains/media/hooks/useImageUpload.ts#L97-L101))는 `convertHeicToJpg` → dedup 순으로 실행하고, 메타데이터 추출은 그 **뒤에 변환된 파일을 대상으로** 돈다. heic2any는 JPEG 재인코딩 과정에서 EXIF를 보존하지 않는 것이 통설이므로, HEIC 사진은 GPS·촬영일을 잃은 채 추출 단계에 도달할 수 있다.

**안드로이드 앱 출시와는 대체로 무관하다.** `convertHeicToJpg`는 `getActualFileType`의 매직바이트 검사로 **HEIC만 변환하고 나머지는 원본 File을 그대로 반환**한다([`image.ts:57-82`](../../src/libs/utils/image.ts#L57-L82)). 안드로이드 기본 카메라는 JPEG이므로 대부분의 사진은 이 경로를 타지 않는다.

영향받는 경로:
- 삼성 갤럭시의 'HEIF 사진' 옵션 사용자 (기본 꺼짐)
- 아이폰 유저에게 공유받은 HEIC 파일
- **현재 운영 중인 웹의 아이폰 유저** — 가장 큰 집단이며, 앱과 무관하게 지금도 영향받는 중

조치: [`app-capacitor-checklist.md`](../app-capacitor-checklist.md) **Phase 2-5 실기기 검증에 HEIC 1장을 테스트 케이스로 포함**했다. 실측으로 손실이 확인되면 별도 작업으로 분리한다(수정 방향은 ① 변환 전 원본에서 메타데이터 추출 후 이식, 또는 ② dedup → 메타추출 → 변환으로 순서 재배치. ②는 중복 HEIC가 두 번 디코딩되는 낭비도 함께 해소된다).

### B. vite config 3중 산출물

`vite.config.ts`, `vite.config.js`, `vite.config.d.ts`가 **모두 git에 추적되고 있다**. `.js`/`.d.ts`는 `tsconfig.node.json`(`composite: true`)의 `tsc -b` 산출물이며 `npm run build`마다 재생성된다.

**함정**: Vite의 설정 해석 우선순위는 `.js`가 `.ts`보다 앞선다. 현재 두 파일의 내용은 동일하지만, 앞으로 `vite.config.ts`만 수정하고 `tsc -b`를 돌리지 않으면 **변경이 조용히 무시된다**.

조치 후보: `.js`/`.d.ts`를 gitignore에 추가하고 삭제하거나, `tsconfig.node.json`에서 `noEmit`을 켠다. 이번 Phase 0의 04는 vite config를 건드리지 않으므로 당장은 막히지 않는다.

### C. `progress.upload` 죽은 상태

`progress` 상태는 `{metadata, upload}` 두 키를 갖지만 **`upload`에 쓰는 코드가 없다**. 결과적으로 [`usePhotoUpload.ts:99-104`](../../src/domains/media/hooks/usePhotoUpload.ts#L99-L104)의 "사진 업로드 중... 0%" 칩은 영구히 0%로 표시된다. 실제 업로드 진행 상황은 `uploadStats: {total, succeeded, failed}`에 정확히 집계되고 있으나, 이 값 역시 두 소비자 모두 구조 분해하지 않아 화면에 나오지 않는다.

조치 후보: `uploadStats`를 진행률로 환산해 `upload`에 연결하거나, `upload` 키와 해당 UI 분기를 제거한다. 사용자에게 보이는 결함이므로 Phase 5(마감) 전에 처리를 권장한다.
