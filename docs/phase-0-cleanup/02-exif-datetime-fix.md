# 02. EXIF 촬영시각 태그 수정

> 상위: [Phase 0 README](README.md) · 체크리스트: `app-capacitor-checklist.md` 0-2
> 성격: **기능 버그 수정** · 03보다 먼저 처리할 것

## 문제

사진의 **촬영시각**을 읽어야 하는데 **파일 저장시각**을 읽고 있다. 변수명은 `dateTimeOriginal`이지만 실제로 읽는 태그가 다르다.

이 값은 여행 타임라인의 날짜별 그룹핑에 직접 쓰이므로, 틀리면 사진이 엉뚱한 날짜에 배치된다.

## 근거

[`src/libs/utils/exif.ts:93-118`](../../src/libs/utils/exif.ts#L93-L118):

```ts
export const extractDateFromImage = async (file: File): Promise<Date | null> => {
    try {
        const exifData = await readExifData(file);
        if (!exifData || !exifData['0th']) return null;

        const dateTimeOriginal = exifData['0th'][piexif.ImageIFD.DateTime] as string | undefined;
        //                                  ^^^^^ 0th IFD          ^^^^^^^^ 태그 306 = 파일 저장시각
        if (!dateTimeOriginal) return null;

        // EXIF 날짜 형식 (예: "2023:04:01 12:34:56")을 파싱
        const [datePart, timePart] = dateTimeOriginal.split(' ');
        const [year, month, day] = datePart.split(':');
        const [hour, minute, second] = timePart.split(':');

        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), ...);
    } catch (error) { ... return null; }
};
```

### 두 태그의 차이

| 태그 | IFD | 번호 | 의미 |
|---|---|---|---|
| `ImageIFD.DateTime` (현재 사용) | `0th` | 306 | 파일이 마지막으로 **기록/수정**된 시각 |
| `ExifIFD.DateTimeOriginal` (올바름) | `Exif` | 36867 | 셔터를 누른 **촬영 시각** |
| `ExifIFD.DateTimeDigitized` | `Exif` | 36868 | 디지털화 시각 (보통 촬영시각과 동일) |

원본 사진에서는 대체로 두 값이 같다. 문제는 **사진이 편집·재저장되거나 메신저를 거친 경우**다. 이때 `DateTime`은 재저장 시점으로 덮어써지지만 `DateTimeOriginal`은 촬영 시점을 유지한다. 즉 "카톡으로 받은 작년 여행 사진"이 오늘 날짜로 잡힌다.

태그 상수는 piexifjs에 이미 존재한다(확인 완료):

```
piexif.ExifIFD.DateTimeOriginal  = 36867
piexif.ExifIFD.DateTimeDigitized = 36868
piexif.ImageIFD.DateTime         = 306
```

### 부수 문제: 무검증 파싱

현재 파싱은 `"YYYY:MM:DD HH:mm:ss"` 형식을 무조건 가정한다. 일부 카메라·앱은 EXIF에 `"0000:00:00 00:00:00"` 같은 빈 값을 넣는데, 이 경우:

1. `new Date(0, -1, 0, 0, 0, 0)` → **`Invalid Date` 객체**가 생성된다 (null이 아니다)
2. 호출부 `formatToISOLocal`([`date.ts:34-45`](../../src/libs/utils/date.ts#L34-L45))은 `if (!date) return ''`로 null만 걸러내므로 `Invalid Date`는 통과
3. `date.getFullYear()` 등이 모두 `NaN` → **`"NaN-NaN-NaNTNaN:NaN:NaN"`** 문자열이 서버로 전송된다

`timePart`가 없는 형식(`"2023:04:01"`)이면 `timePart.split(':')`에서 TypeError가 나는데, 이건 try/catch가 잡아 null을 반환하므로 결과적으로는 안전하다.

## 개선 방안

### 1) 태그 우선순위 폴백

`DateTimeOriginal` → `DateTimeDigitized` → `0th.DateTime` 순으로 시도한다. 마지막 폴백을 남기는 이유는, 일부 오래된/가공된 파일이 `Exif` IFD 없이 `0th`만 갖는 경우에도 기존만큼은 동작하게 하기 위해서다(회귀 방지).

```ts
const readDateTimeTag = (exifData: Exif): string | undefined => {
    const exifIfd = exifData['Exif'];
    const zerothIfd = exifData['0th'];

    return (
        (exifIfd?.[piexif.ExifIFD.DateTimeOriginal] as string | undefined) ??
        (exifIfd?.[piexif.ExifIFD.DateTimeDigitized] as string | undefined) ??
        (zerothIfd?.[piexif.ImageIFD.DateTime] as string | undefined)
    );
};
```

타입은 이미 준비되어 있다 — [`src/shared/types/exif.ts`](../../src/shared/types/exif.ts)의 `Exif` 인터페이스에 `Exif?: IfdData` 키가 있으므로 **타입 변경이 필요 없다**.

### 2) 파싱 유효성 검사

정규식으로 형식을 먼저 확인하고, 생성된 `Date`가 유효한지 마지막에 검사한다.

```ts
const EXIF_DATETIME_PATTERN = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

const parseExifDateTime = (raw: string): Date | null => {
    const matched = raw.match(EXIF_DATETIME_PATTERN);
    if (!matched) return null;

    const [, year, month, day, hour, minute, second] = matched;
    const date = new Date(+year, +month - 1, +day, +hour, +minute, +second);

    // "0000:00:00 00:00:00" 같은 빈 값 방어
    return Number.isNaN(date.getTime()) ? null : date;
};
```

`extractDateFromImage`는 이 두 헬퍼를 조합해 단순해진다. 실패는 모두 `null` → 호출부에서 `''`(날짜 미지정)로 이어지고, 기존 "날짜 미지정" 폴백 UI가 그대로 처리한다.

> **주의**: 시간대. `new Date(year, month-1, ...)`는 **브라우저 로컬 시간대**로 해석하고, `formatToISOLocal`도 로컬 게터를 쓴다. 즉 EXIF의 벽시계 시각이 그대로 문자열이 된다. 해외 여행 사진이라도 현지 시각이 보존되는 현재 동작이 이 앱에는 자연스러우므로 **바꾸지 않는다**.

## 변경 파일

| 파일 | 변경 |
|---|---|
| [`src/libs/utils/exif.ts`](../../src/libs/utils/exif.ts) | 태그 폴백 + 파싱 검증 헬퍼 추가, `extractDateFromImage` 정리 |
| `src/libs/utils/exif.test.ts` | **신규** — 단위 테스트 |

호출부 변경 없음. `extractDateFromImage`의 시그니처(`Promise<Date | null>`)는 그대로다.

## 검증

[공통 검증](README.md#공통-검증)에 더해:

### 단위 테스트 (신규 `src/libs/utils/exif.test.ts`)

파싱 헬퍼를 export하면 File 없이 순수 함수로 테스트할 수 있다. 케이스:

- [ ] `DateTimeOriginal`이 있으면 그 값을 쓴다
- [ ] `DateTimeOriginal`이 없고 `DateTimeDigitized`만 있으면 그것을 쓴다
- [ ] `Exif` IFD가 통째로 없으면 `0th.DateTime`으로 폴백한다
- [ ] `DateTimeOriginal`과 `0th.DateTime`이 **다를 때 전자를 택한다** ← 이 버그의 핵심 케이스
- [ ] `"0000:00:00 00:00:00"` → `null` (이전에는 `Invalid Date`)
- [ ] `"2023:04:01"` (시간 없음) → `null`
- [ ] 셋 다 없으면 `null`

### 수동 확인

- [ ] 촬영 후 편집한 사진(또는 메신저로 주고받은 사진)을 업로드 → **촬영일 기준**으로 그룹핑되는지 확인. 수정 전에는 업로드 당일로 잡혔을 것이다
- [ ] 원본 사진 업로드 → 기존과 동일하게 동작(회귀 없음)

## 리스크

**낮음–중간.**

- 폴백 체인 덕분에 기존에 성공하던 케이스는 그대로 성공한다. 최악의 경우에도 이전과 같은 값을 얻는다.
- 다만 **기존에 업로드된 사진의 날짜는 소급 수정되지 않는다.** 이미 서버에 저장된 `recordDate`는 그대로다. 소급 정정이 필요하다면 별도 마이그레이션 작업이며 이 문서 범위 밖이다.
- 유효성 검사 추가로 이전에 `"NaN-NaN-..."`으로 통과하던 값이 이제 `''`(날짜 미지정)이 된다. **의도된 개선**이며, 해당 사진은 날짜 수동 지정 플로우로 유도된다.
