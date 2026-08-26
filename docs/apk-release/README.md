# APK 배포 가이드

> 스토어가 아니라 링크에서 APK를 직접 내려받는 방식이다.
> 스토어가 대신 해주던 것(서명 검증, 자동 업데이트, 설치 절차 안내)을 우리가 책임진다.

## 1. 배포 (한 줄)

```bash
npm run apk:publish patch     # 1.0.0 → 1.0.1
npm run apk:publish minor     # 1.0.0 → 1.1.0
npm run apk:publish major     # 1.0.0 → 2.0.0
npm run apk:publish 1.2.3     # 명시
```

**버전은 스크립트가 알아서 올린다.** `build.gradle`의 versionCode·versionName과
`appVersion.ts`를 한 번에 맞추고 커밋까지 한다. versionCode는 항상 +1 된다.

빌드가 실패하면 버전 변경을 되돌리므로, 실패한 채로 버전만 올라가는 일은 없다.

이 명령 하나가 버전 상향 → 빌드 → 검증 → 커밋 → 태그 → GitHub Release까지 하고,
Release가 발행되면 CI(`.github/workflows/apk-publish.yml`)가 **OCI 업로드와 구버전 삭제**를
이어받는다. 릴리스 노트에는 직전 릴리스 이후의 커밋이 자동으로 담긴다.

### 앱 재배포를 잊지 않도록

앱은 웹사이트를 불러오는 게 아니라 **빌드 시점의 웹 자산을 APK 안에 담는다.**
그래서 FE를 고쳐 웹에 배포해도 **앱 사용자는 재배포 전까지 옛 화면을 본다.**

`main`이 움직일 때마다 `APK Staleness` 워크플로우가 마지막 릴리스 이후 앱에 영향을 주는
변경이 쌓였는지 확인하고, 있으면 Actions 요약에 경고를 남긴다.

빌드만 하고 싶으면:

```bash
npm run apk:release
```

산출물: `android/app/build/outputs/apk/release/app-release.apk`

### 왜 CI가 APK를 빌드하지 않는가

서명 키스토어를 GitHub Secrets에 올리면, 저장소나 시크릿이 뚫렸을 때 공격자가
**'정품 트립티케'로 서명된 APK**를 만들 수 있다. 안드로이드는 서명이 같으면 기존 앱의
업데이트로 인정하므로, 사용자 기기에서 악성 앱으로 조용히 교체될 수 있다.

그래서 빌드·서명은 이 맥에서만 하고, CI는 이미 서명된 APK를 배포·정리만 한다.

### OCI에 올라가는 것

| 경로 | 용도 |
|---|---|
| `app/triptyche-latest.apk` | **사용자에게 안내하는 고정 링크.** 매번 덮어쓰고 `no-cache`를 건다 |
| `app/triptyche-{version}.apk` | 이력·롤백용 |

배포가 끝나면 **직전 버전 파일은 삭제**된다. 위 두 개만 남는다.

### CI에 필요한 GitHub Secrets

백엔드와 같은 OCI 자격증명을 쓴다.

```
OCI_S3_ENDPOINT
OCI_ACCESS_KEY
OCI_SECRET_KEY
```

이 스크립트는 사고를 막기 위해 다음을 **자동으로 검증하고, 실패하면 빌드를 중단**한다.

| 검증 | 막는 사고 |
|---|---|
| 번들의 API 주소가 프로덕션인가 | `.env.app.local`의 로컬 주소(`10.0.2.2`)가 박히면 배포본의 API가 전부 실패한다 |
| 개발용 주소가 남아 있지 않은가 | 위와 같음 |
| DEV 로그인이 포함되지 않았는가 | 개발 전용 진입점이 배포본에 노출 |
| APK가 서명됐는가 | 미서명 APK는 설치 자체가 안 된다 |

눈으로 확인하는 절차는 언젠가 반드시 놓치므로 전부 자동화했다.

## 2. 배포할 때마다 올려야 하는 것

> `apk:publish`가 아래 ①②의 일치를 검사하고, 어긋나면 빌드를 중단한다.
> CI도 태그와 대조해 한 번 더 확인한다.

APK 직배포는 **자동 업데이트가 없다.** 구버전 사용자가 계속 남으므로 버전을 정확히 관리해야 한다.

**① `android/app/build.gradle`**
```gradle
versionCode 2        // 정수. 반드시 증가
versionName "1.1.0"  // semver
```

**② `src/platform/native/appVersion.ts`**
```ts
export const APP_VERSION_NAME = '1.1.0';   // build.gradle의 versionName과 동일하게
```

두 곳에 있는 이유는 gradle(네이티브 빌드)과 JS 번들이 서로를 읽을 수 없기 때문이다.
**①②는 `apk:publish`가 자동으로 맞추므로 직접 고칠 필요가 없다.**

**③ 서버가 내려주는 최신 버전** — **자동이다.** 배포 워크플로가 APK와 함께
`app/version.json`을 올리고, 백엔드가 그 파일을 읽어 `latestVersion`으로 내려준다.

```json
{ "latestVersion": "1.1.0", "latestVersionCode": 3, "publishedAt": "..." }
```

> 예전에는 서버 환경변수 `APP_LATEST_VERSION`을 손으로 올려야 했고, 실제로 어긋난 채
> 방치됐다(서버 1.0.0 / 배포된 APK 1.0.1). '무엇이 최신 빌드인가'는 배포만 아는 사실이라
> 배포가 발행하도록 바꿨다. 조회에 실패하면 서버는 기존 `APP_LATEST_VERSION` 값으로 되돌아간다.

**④ 정책 값** — 이쪽은 판단이 필요해 수동으로 남겨 뒀다 (백엔드 배포 권한 필요).
```
APP_MIN_SUPPORTED_VERSION=1.0.0    # 이 미만은 앱이 차단된다
APP_UPDATE_URL=<APK 다운로드 주소>
```

> 백엔드는 버전을 비교하지 않는다. 값을 그대로 내려줄 뿐이고, 비교는 앱이 한다
> (`src/platform/native/appUpdate.ts`).

앱은 부팅 시 `GET /v1/app/config`로 이 값을 읽어 안내한다.
`minSupportedVersion` 미만이면 **닫을 수 없는 안내**가 뜨므로, API 호환이 실제로 깨졌을 때만 올린다.

## 3. 서명 키 — 잃어버리면 되돌릴 수 없다

`android/triptyche-release.jks`와 `android/keystore.properties`는 git에 올라가지 않는다.

**이 두 파일을 잃으면 같은 앱으로 업데이트를 낼 수 없다.** 안드로이드는 서명이 다른 APK를 같은 앱의 업데이트로 인정하지 않으므로, 기존 사용자는 앱을 지우고 새로 설치해야 한다(데이터도 함께 사라진다).

**반드시 안전한 곳에 백업할 것.** 비밀번호 관리자나 암호화된 저장소를 권한다.

## 4. 사용자에게 안내할 설치 방법

배포 페이지에 아래 내용을 넣는다.

---

### 트립티케 앱 설치하기

Google Play가 아닌 곳에서 받는 앱이라 설치 중 경고가 표시됩니다. 아래 순서대로 진행해 주세요.

1. **APK 내려받기** — 아래 버튼을 누르면 다운로드가 시작됩니다.
2. **"이런 유형의 파일은 기기에 해로울 수 있습니다"** 경고가 뜨면 **[계속]** 또는 **[확인]**을 누릅니다.
3. 다운로드가 끝나면 알림을 눌러 파일을 엽니다.
4. **"보안 위험 차단됨"** 또는 **"출처를 알 수 없는 앱"** 안내가 뜨면 **[설정]**을 눌러 이 앱의 설치를 허용해 주세요.
5. **[설치]**를 누르면 완료됩니다.

**요구 사항**: Android 7.0 이상

**경고가 뜨는 이유**: Google Play를 거치지 않은 앱은 안드로이드가 출처를 확인할 수 없어 기본적으로 차단합니다. 앱 자체의 문제가 아닙니다.

**업데이트**: 새 버전이 나오면 앱이 알려드립니다. 같은 방법으로 새 APK를 설치하면 기존 데이터가 유지된 채로 업데이트됩니다.

---

## 5. 배포 전 확인

- [ ] `npm run apk:release`가 검증을 모두 통과했는가
- [ ] `versionCode`·`versionName`·`APP_VERSION_NAME` 세 곳이 일치하는가
- [ ] `APP_UPDATE_URL`이 실제 다운로드 페이지를 가리키는가
- [ ] 실기기에서 설치 → 로그인 → 사진 업로드가 동작하는가
