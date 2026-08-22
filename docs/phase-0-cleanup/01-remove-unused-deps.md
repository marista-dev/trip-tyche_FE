# 01. 미사용 의존성 제거

> 상위: [Phase 0 README](README.md) · 체크리스트: `app-capacitor-checklist.md` 0-1
> 성격: 저위험 정리 · 선행 조건 없음

## 문제

`package.json`에 설치되어 있으나 **코드에서 한 번도 import되지 않는** 패키지가 6개 있다.

```
@deck.gl/core          ^9.3.2
@deck.gl/geo-layers    ^9.3.2
@deck.gl/google-maps   ^9.3.2
@deck.gl/layers        ^9.3.2
@deck.gl/mesh-layers   ^9.3.2
browser-image-compression  ^2.0.2
```

두 가지 비용이 있다.

1. **판단을 오염시킨다.** 기존 기획 문서(`app-release-strategy.md` 초판)는 Deck.gl을 실사용 자산으로 보고 "네이티브 재작성 시 재구현 필요"라는 리스크로 반복 인용했다. 실제로는 존재하지 않는 리스크였다. 마찬가지로 앱 번들 크기를 측정할 때도 기준선이 부풀려진다.
2. **설치·빌드 시간과 `node_modules` 용량**을 점유한다.

## 근거

저장소 전체에서 참조를 검색한 결과, **`package.json` 외의 등장이 0건**이다.

```bash
grep -rn "deck\.gl\|deckgl\|DeckGL\|browser-image-compression\|imageCompression" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.html" . \
  | grep -v node_modules | grep -v package-lock
```

결과는 `package.json`의 선언 6줄뿐이다. `src/`, `index.html`, `vite.config.ts`, `scripts/` 어디에도 없다.

참고로 실제 시각화에 쓰이는 것은 `three`(3D 지구본)와 `@react-google-maps/api`(지도·드론뷰)이며, 이 둘은 그대로 유지한다.

## 개선 방안

패키지 6개를 제거한다.

```bash
npm uninstall @deck.gl/core @deck.gl/geo-layers @deck.gl/google-maps \
              @deck.gl/layers @deck.gl/mesh-layers browser-image-compression
```

`package.json`과 `package-lock.json`이 함께 갱신된다.

> **주의**: 이 저장소는 npm을 쓴다. `yarn`은 설치되어 있지 않다.

### 관련 문서 정합성

제거 후 기존 문서의 서술은 이미 정정되어 있다(`app-release-strategy.md` §7.1, `app-frontend-tasks.md` 1.4). 추가 수정은 불필요하나, 혹시 남은 언급이 있는지 확인한다.

```bash
grep -rn "deck\.gl\|Deck\.gl" docs/
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `package.json` | dependencies에서 6줄 제거 |
| `package-lock.json` | 자동 갱신 |

코드 파일 변경 없음.

## 검증

[공통 검증](README.md#공통-검증)에 더해:

- [ ] `npm run build` 성공 — 타입 에러나 모듈 해석 실패가 없어야 한다. 실패한다면 grep이 놓친 동적 import가 있다는 뜻이므로 되돌리고 재조사한다.
- [ ] **번들 크기 비교** — `rollup-plugin-visualizer`가 빌드마다 루트에 `stats.html`을 생성한다. 제거 **전** 빌드의 `stats.html`을 따로 보관해두고 제거 후와 비교한다.
  ```bash
  npm run build && cp stats.html /tmp/stats-before.html   # 제거 전
  # ...제거...
  npm run build                                            # stats.html 갱신됨
  ```
  트리셰이킹이 이미 잘 동작하고 있었다면 번들 크기는 **거의 변하지 않을 수 있다** — 그래도 정상이다. 이 작업의 주 목적은 번들 축소가 아니라 의존성 목록의 정확성 회복이다.
- [ ] `npm ci` 로 클린 설치가 성공하는지 한 번 확인 (lock 파일 정합성)

## 리스크

**낮음.** 되돌리기도 `npm install <패키지>` 한 줄이다.

유일하게 신경 쓸 부분은 **동적 import를 grep이 놓쳤을 가능성**인데, `npm run build`가 이를 잡아준다. Vite는 정적 분석으로 해석되지 않는 import를 빌드 시점에 경고하거나 실패시킨다.
