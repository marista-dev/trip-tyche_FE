# 03. 메타데이터 추출 메모리·동시성 개선

> 상위: [Phase 0 README](README.md) · 체크리스트: `app-capacitor-checklist.md` 0-3
> 성격: 성능·안정성 · **02 완료 후 착수** (같은 파일을 건드린다)

## 문제

사진 N장을 업로드할 때 메타데이터 추출 단계에서 **N × 2회의 전체 파일 base64 읽기가 동시에** 일어난다. base64는 원본의 약 1.33배이므로, 3MB 사진 200장이면 순간적으로 GB 단위 문자열이 힙에 올라간다.

브라우저에서는 그럭저럭 버텨왔지만, **WebView는 앱 프로세스의 메모리 한도를 공유**한다. 안드로이드에서 대량 업로드 시 OOM으로 앱이 죽을 위험이 실제로 있다. 앱 출시 전에 정리해야 하는 이유다.

## 근거

### 문제 1 — 파일당 base64를 2번 읽는다

[`src/libs/utils/image.ts:31-53`](../../src/libs/utils/image.ts#L31-L53):

```ts
return await Promise.all(
    Array.from(images).map(async (image) => {
        const location = await extractLocationFromImage(image);   // ← readExifData 1회
        const date = await extractDateFromImage(image);           // ← readExifData 또 1회
        ...
    }),
);
```

`extractLocationFromImage`와 `extractDateFromImage`는 각각 독립적으로 `readExifData(file)`를 호출하고([`exif.ts:80-118`](../../src/libs/utils/exif.ts#L80-L118)), `readExifData`는 매번 `FileReader.readAsDataURL(file)`로 **파일 전체를 base64 문자열로** 읽는다([`exif.ts:7-28`](../../src/libs/utils/exif.ts#L7-L28)).

같은 파일에서 같은 EXIF 객체를 두 번 만들고 있다. 순수한 낭비다.

### 문제 2 — 동시성 제한이 없다

`Promise.all`은 배열의 모든 프로미스를 **즉시 동시에** 시작한다. 200장을 고르면 200개의 FileReader가 한꺼번에 뜬다.

같은 파일의 업로드 단계에는 이미 제대로 된 워커 풀이 있는데, 추출 단계만 빠져 있다.

### 이미 있는 자산 — `runWithPool`

[`useImageUpload.ts:22-38`](../../src/domains/media/hooks/useImageUpload.ts#L22-L38)에 정확히 필요한 유틸이 이미 있다:

```ts
// limit개의 워커가 풀처럼 items를 소비. Promise.all을 그대로 쓰면 N개 모두를 동시 시작하므로 부적합.
async function runWithPool<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        let i = next++;
        while (i < items.length) {
            results[i] = await worker(items[i], i);
            i = next++;
        }
    });
    await Promise.all(runners);
    return results;
}
```

S3 업로드에서 이미 검증된 코드이고, **결과를 인덱스 위치에 직접 쓰기 때문에 입력 순서를 보존한다**. 아래 "순서 보존" 항목 때문에 이 성질이 결정적이다.

> 참고: `src/domains/media/utils/DecodeQueue.ts`에도 동시성 제한기가 있지만, `add()`가 void를 반환하고 에러를 삼키는 fire-and-forget 구조라 결과 수집에 쓸 수 없다. `SwappableImage.tsx` 전용이므로 **건드리지 않는다**.

### ⚠️ 반드시 지켜야 할 불변조건 — 인덱스 정렬

`uploadImagesToS3`는 메타데이터와 presigned URL을 병렬로 받은 뒤, **인덱스로 짝을 맞춘다**([`useImageUpload.ts:103-121`](../../src/domains/media/hooks/useImageUpload.ts#L103-L121)):

```ts
const items = presignedUrls.map((url, index) => {
    const { recordDate, latitude, longitude } = images[index];   // ← 위치 기반 매칭
    return { mediaFileId: url.mediaFileId, latitude, longitude, recordDate };
});
```

즉 `imagesWithMetadata[i]` ↔ `presignedUrls[i]` ↔ `fileArray[i]`가 항상 같은 사진을 가리켜야 한다.

**추출 결과를 정렬하거나, 실패 항목을 필터링하거나, 완료 순서대로 스트리밍하면 GPS·날짜가 다른 사진에 조용히 배정된다.** 에러도 나지 않고 그냥 틀린 위치에 핀이 찍힌다. `runWithPool`은 위치 기반 쓰기로 순서를 보존하므로 이 조건을 만족한다.

## 개선 방안

### 1) `runWithPool`을 공용 유틸로 추출

`useImageUpload.ts`의 모듈 지역 함수를 `src/libs/utils/async.ts`로 옮기고 양쪽에서 import한다. 로직은 그대로 옮기고 동작을 바꾸지 않는다(순수 이동).

```ts
// src/libs/utils/async.ts
export async function runWithPool<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> { /* 기존 구현 그대로 */ }
```

`useImageUpload.ts`는 지역 정의를 지우고 import로 대체한다. 업로드 동작에는 영향이 없어야 한다.

### 2) EXIF를 1회만 읽고 위치·날짜를 함께 뽑는다

`exif.ts`에 EXIF 객체 하나에서 둘 다 추출하는 함수를 추가한다. 기존 `extractLocationFromImage` / `extractDateFromImage`는 **시그니처를 유지**하되 내부적으로 이 함수를 쓰도록 정리한다(외부 호출자는 `image.ts`뿐이지만, 공개 API를 깨지 않는 편이 안전하다).

```ts
// exif.ts — 신규 export
export const extractMetadataFromExif = async (
    file: File,
): Promise<{ location: Location | null; date: Date | null }> => {
    const exifData = await readExifData(file);        // ← 파일당 정확히 1회
    if (!exifData) return { location: null, date: null };

    return {
        location: extractGpsFromExifData(exifData),
        date: extractDateFromExifData(exifData),      // 02에서 정리한 태그 폴백 사용
    };
};
```

이것이 **02를 먼저 끝내야 하는 이유**다. 02에서 날짜 추출을 "EXIF 객체 → Date" 순수 함수로 분리해두면 여기서 그대로 조합된다.

### 3) 추출 루프에 동시성 상한 적용

```ts
// image.ts
const METADATA_EXTRACTION_CONCURRENCY = 4;

export const extractMetadataFromImage = async (
    images: readonly File[],
    onProgress?: Dispatch<SetStateAction<{ metadata: number; upload: number }>>,
): Promise<ClientImageFile[]> => {
    if (images.length === 0) return [];

    let processed = 0;
    const fileList = Array.from(images);

    return runWithPool(fileList, METADATA_EXTRACTION_CONCURRENCY, async (image) => {
        const { location, date } = await extractMetadataFromExif(image);

        processed++;
        onProgress?.((prev) => ({ ...prev, metadata: Math.round((processed / fileList.length) * 100) }));

        return {
            image,
            recordDate: formatToISOLocal(date),
            latitude: location?.latitude || 0,
            longitude: location?.longitude || 0,
        };
    });
};
```

**시그니처와 반환 타입은 그대로 유지한다.** `onProgress`의 `Dispatch<SetStateAction<{metadata, upload}>>` 타입도 유지 — [`ProcessingStep.tsx`](../../src/domains/media/components/upload/ProcessingStep.tsx)와 [`usePhotoUpload.ts:99-104`](../../src/domains/media/hooks/usePhotoUpload.ts#L99-L104)가 소비 중이므로 여기서 바꾸면 범위가 번진다(`progress.upload` 정리는 README 추가 발견 C 참조).

동시성 4의 근거: `DecodeQueue`의 기본값과 동일하고, FileReader는 I/O 바운드라 4면 처리량이 충분히 난다. 실측 후 조정 가능한 상수로 둔다.

### 4) (선택) 부분 읽기 검토 — 측정 후 결정

`piexif.load()`는 JPEG 앞부분의 APP1 세그먼트만 필요하므로, 이론적으로는 `file.slice(0, N)`만 읽어도 된다. 파일 전체 대신 앞 128KB만 읽으면 메모리가 극적으로 줄어든다.

다만 **EXIF 세그먼트 크기는 가변**이고(썸네일이 임베드되면 커진다), 잘린 데이터에서 `piexif.load`가 어떻게 실패하는지 검증이 필요하다. 1~3번만으로 읽기 횟수가 절반이 되고 동시성이 4로 제한되므로 **먼저 그 효과를 측정한 뒤** 필요할 때 착수한다. 이번 범위에 넣지 않는다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `src/libs/utils/async.ts` | **신규** — `runWithPool` 이동 |
| [`src/domains/media/hooks/useImageUpload.ts`](../../src/domains/media/hooks/useImageUpload.ts) | 지역 `runWithPool` 삭제 → import |
| [`src/libs/utils/exif.ts`](../../src/libs/utils/exif.ts) | `extractMetadataFromExif` 추가, 기존 두 함수 내부 정리 |
| [`src/libs/utils/image.ts`](../../src/libs/utils/image.ts) | `extractMetadataFromImage`를 풀 기반으로 교체 |
| `src/libs/utils/async.test.ts` | **신규** — 풀 동작·순서 보존 테스트 |
| `src/libs/utils/image.test.ts` | **신규** — 추출 결과 순서·진행률 테스트 |

## 검증

[공통 검증](README.md#공통-검증)에 더해:

### 단위 테스트

`async.test.ts` — 기존 [`DecodeQueue.test.ts`](../../src/domains/media/utils/DecodeQueue.test.ts)의 deferred 패턴을 그대로 참고한다:
- [ ] 동시 실행 수가 limit을 넘지 않는다
- [ ] **결과 배열 순서가 입력 순서와 같다** (완료 순서가 뒤섞여도) ← 핵심
- [ ] `items.length < limit`인 경우 정상 동작
- [ ] 빈 배열 → 빈 배열

`image.test.ts`:
- [ ] 파일당 `readAsDataURL` **호출 횟수가 1회**인지 (FileReader를 스텁하고 카운트)
- [ ] 반환 배열의 각 원소가 입력 File과 올바르게 짝지어졌는지
- [ ] `onProgress`가 최종적으로 100에 도달하는지
- [ ] EXIF 없는 파일 → `latitude: 0, longitude: 0, recordDate: ''`

### 수동 회귀 — 가장 중요

- [ ] **사진 30장 이상**을 업로드하고, 지도의 핀 위치와 각 사진이 **정확히 대응**하는지 육안 확인. 인덱스 오배정은 자동 테스트로 잡기 어렵고 데이터가 조용히 틀어진다
- [ ] 진행률 바가 0 → 100으로 매끄럽게 오르는지 (`ProcessingStep`)
- [ ] 위치·날짜가 없는 사진이 섞여 있을 때 "위치 미지정" 분류가 이전과 동일한지
- [ ] 업로드 재시도(`retryFailedUploads`)·오프라인 전환 동작이 그대로인지 — `runWithPool` 이동이 업로드 경로에 영향을 주지 않았는지 확인

### 메모리 개선 확인 (선택)

Chrome DevTools Performance 탭에서 30~50장 업로드 중 JS Heap 피크를 수정 전후로 비교한다. 이론상 절반 이하 + 피크가 완만해진다.

## 리스크

**중간.** 이 문서에서 가장 조심할 항목이다.

| 리스크 | 대응 |
|---|---|
| **인덱스 오배정** — GPS·날짜가 다른 사진에 붙음. 에러 없이 조용히 틀림 | `runWithPool`의 위치 기반 쓰기를 유지. 결과를 절대 정렬·필터링하지 않는다. 수동 회귀에서 육안 확인 |
| `runWithPool` 이동이 업로드 경로를 건드림 | 로직 변경 없이 순수 이동. 업로드 재시도·오프라인 시나리오 회귀 확인 |
| 동시성 4가 너무 느림 | 상수로 분리해 조정 가능하게. 실측 후 8까지 올려볼 수 있다 |
| 02와 충돌 | 02를 먼저 머지하고 시작 |
