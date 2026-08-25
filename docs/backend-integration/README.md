# 백엔드 연동 — FE가 알아야 할 것

> 최종 갱신: 2026-08-25
> 백엔드 저장소의 M1(인증)·M2(푸시) 작업 결과 중 **FE에 영향이 있는 것만** 정리한다.
> 전체 설계 배경은 백엔드 저장소 `doc/backend-app-release/`에 있다.

| 문서 | 내용 | 상태 |
|---|---|---|
| [01-auth.md](01-auth.md) | 앱 OAuth 딥링크, 토큰 교환·갱신, 세션 모델 | **배포 완료** (BE PR #197) |
| [02-push.md](02-push.md) | FCM 푸시, 디바이스 토큰 등록 | **PR 대기** |

---

## 지금 상태

**동작하는 것**

- 앱 OAuth 로그인 (카카오·구글) — 딥링크 → 1회용 code → 토큰 교환
- 토큰 자동 갱신 (`refreshAccessToken`)
- 게스트 로그인
- FCM 토큰 발급 (`src/platform/native/push.ts` — 콘솔 로그만)

**아직 안 된 것**

- 디바이스 토큰을 서버에 보내기 (BE PR 머지 후)
- 알림 채널 선언 → 헤드업 배너
- 알림 탭 시 화면 이동

---

## FE TODO

우선순위 순.

### P0 — BE M2 머지 직후

- [ ] `push.ts`에서 발급받은 토큰을 `POST /v1/devices`로 전송
      → [02-push.md](02-push.md) 1절
- [ ] 등록 시점을 **로그인 직후**로 옮기기 (현재는 앱 부팅 시)
      → 인증이 필요한 API라 토큰이 없으면 401
- [ ] 로그아웃 시 `DELETE /v1/devices/{token}` 호출

### P1 — 출시 전

- [ ] 기본 알림 채널 선언 — 현재 미선언이라 시스템 기본 중요도로 떨어져
      **헤드업 배너가 안 뜰 수 있다** → [02-push.md](02-push.md) 4절
- [ ] 알림 탭 시 `data.deeplink`로 화면 이동 → [02-push.md](02-push.md) 3절
- [ ] OAuth 실패 딥링크의 `error` 파라미터를 읽어 사용자에게 안내
      → [01-auth.md](01-auth.md) 3절

### P2 — 여유 있을 때

- [ ] `CapacitorHttp` 우회 의존 줄이기 — CORS에 앱 origin이 추가되어 정공법이 열렸다
      → [01-auth.md](01-auth.md) 5절
- [ ] STOMP 연결 시도 — 같은 이유로 이제 앱에서도 가능하다

---

## 바꾸면 BE도 같이 고쳐야 하는 것

| 바꾸는 것 | BE에서 고칠 곳 |
|---|---|
| 딥링크 스킴 `triptyche://auth/callback` | `application.yml`의 `app-auth.allowed-redirects` |
| 패키지명 `cloud.triptyche.app` | Firebase 콘솔 Android 앱 등록 |
| 토큰 응답 필드명 | `TokenIssueResponse` |
| 디바이스 등록 요청 필드명 | `DeviceRegisterRequest` |
