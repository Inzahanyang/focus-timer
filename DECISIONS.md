# DECISIONS — 기술·디자인 결정 기록

> 형식: 날짜 · 결정 · 이유. 비자명한 결정만 기록한다.

## 2026-08-12

**D1. 메타포를 지형(topography) 하나로 통일** — 초기 구상(Orbit/Constellation)은 지도+우주 두 메타포가 섞여 제품 일관성이 약했다. Atlas에 맞춰 등고선·지층·지형으로 통일. 우주 계열 시각 언어 폐기.

**D2. UI 언어 영어 확정** — 제품 고유 어휘(contour, landscape, Atlas Notes)가 영어에서 하나의 세계를 이룬다. 단, 기능 문구는 평범하고 명확하게, 은유는 핵심 순간에만. README·제출 설명은 한국어. v1 언어 전환 없음.

**D3. 타이머는 endAt 절대 타임스탬프 기반** — 과제 노트는 setInterval 카운트다운을 제안하지만, 브라우저 탭 스로틀링으로 드리프트가 생긴다. `remaining = ceil((endAt - now)/1000)`로 파생하고 interval은 리페인트 용도만. 과제 요구("localStorage로 새로고침 후 유지")를 더 정확하게 충족하는 구현이다.

**D4. HashRouter** — GitHub Pages 프로젝트 페이지에서 직접 진입·새로고침에 404 없이 동작하는 최저위험 옵션. 404.html 트릭보다 단순하다.

**D5. X-Client-ID 익명 기기 격리** — 로그인 없는 공개 배포에서 모든 방문자가 한 데이터셋을 공유하는 것을 방지. `crypto.randomUUID()`를 localStorage에 저장, 모든 요청 헤더로 전송. 백엔드는 UUID 검증 후 모든 쿼리를 client_id로 스코프. 계정 시스템이 아니라 격리 레이어다.

**D6. 시간 저장은 UTC, 경계 계산은 X-Timezone** — DB 타임스탬프는 naive UTC로 통일. 주(월~일)·월·streak 경계는 클라이언트 IANA 시간대로 계산. 잘못된 시간대는 UTC로 폴백(400 대신 — 통계가 틀어질지언정 앱이 죽으면 안 됨).

**D7. 응답 created_at = completed_at, UTC 'Z' 접미사 포함** — 과제 예시는 `2026-04-20T14:30:00`(접미사 없음)이지만, 접미사 없는 ISO를 JS `new Date()`가 로컬로 해석해 시간대 버그를 만든다. `Z`를 붙여도 ISO 8601이며 과제 필드 계약(필드명·존재)은 유지된다.

**D8. Subject 삭제는 soft delete(archived_at)** — 하드 삭제하면 과거 세션의 과목 표시가 깨진다. 세션은 subject_name_snapshot을 보존한다. DELETE API 응답은 과제 그대로 `{success: true}`.

**D9. 멱등 저장 이중 방어** — 프론트: 세션 시작 시 completionId(UUID) 생성, 완료 POST에 Idempotency-Key로 전송. 백엔드: `(client_id, idempotency_key)` unique — 중복 POST는 기존 레코드 반환. StrictMode 이중 이펙트·리로드·재시도 모두 방어.

**D10. 로컬 SQLite / 배포 PostgreSQL(DATABASE_URL)** — Railway 재배포에서 SQLite 파일은 증발한다. psycopg는 배포 시점에 추가.

**D11. 백엔드 로컬 포트 5001** — macOS AirPlay Receiver가 5000을 점유.

**D12. Python 3.9 호환으로 작성** — 로컬이 시스템 3.9.6뿐. `X | Y` 유니언 금지, zoneinfo는 3.9+ 내장이라 사용 가능. Railway(3.11+)와 양쪽 호환.

**D13. Dashboard 지형은 릿지라인 우선** — 2D 등고선 지도는 희소 데이터(심사자의 0~3세션)에서 깨져 보인다. 월~일 7능선 릿지라인은 데이터가 적어도 "낮고 조용한 지형"으로 자연스럽고 100% 메타포 안이다. 2D 지도는 여력 시 스트레치.

**D14. streak 화면 표기는 continuity** — 불꽃 아이콘·경쟁 어휘 배제. API 필드명은 과제 그대로 `streak`, aria-label은 "Current focus streak: N consecutive days"로 의미 고정.

**D15. CORS preflight는 identity 검증 제외** — OPTIONS 요청은 커스텀 헤더를 싣지 않으므로 X-Client-ID 검증을 건너뛴다. 안 그러면 모든 브라우저 요청이 preflight에서 400으로 죽는다.

## 2026-08-12 (Codex 감사 라운드 1 반영)

**D16. 타이머 phase와 저장 상태 분리** — `saving_focus` 상태 폐기. 집중 만료 즉시 휴식이 시작되고(이론적 종료 시점 anchor), 저장은 독립된 `save: {session, status}` 필드로 병행. 네트워크가 느려도 알림·휴식이 막히지 않는다.

**D17. 타이머 소유권을 라우트 밖으로** — `TimerProvider`가 HashRouter 바로 아래에서 스케줄러·복원·저장을 소유. History/Dashboard에 있어도 완료가 처리된다. 시각 모드(focus/break)는 Timer 라우트에서만 적용, 다른 화면은 종이 모드 유지.

**D18. 만료 후 사용자 명령은 완료가 이긴다** — remaining이 0에 도달한 뒤 Pause/Reset이 들어오면 reducer가 먼저 완료를 처리한다. Reset은 미완료 세션을 저장하지 않지만(T3), 이미 만료된 세션의 저장 페이로드는 Reset을 넘어 보존된다.

**D19. 클라이언트 ID는 canonical UUID로 저장** — 백엔드는 `str(uuid.UUID(raw))`로 정규화(하이픈 유무·중괄호·URN 표기가 같은 클라이언트). 프론트는 모듈 스코프 메모 + 저장값 UUID 검증(storage 실패 시에도 페이지 생명주기 동안 단일 ID).

**D20. 중복 방어는 DB가 진실** — 과목 중복은 partial unique index(`archived_at IS NULL`)가 최종 보장, 라우트 pre-check는 친절한 에러용. IntegrityError → 409 변환. SQLite `PRAGMA foreign_keys=ON`.

**D21. 프로덕션 빌드는 API URL 누락 시 즉시 실패** — `import.meta.env.PROD && !VITE_API_BASE_URL`이면 throw. 배포된 페이지가 방문자의 localhost를 호출하는 사고 방지.

**미해결(다음 마일스톤)**: 서버 멱등 완성(동시 POST), completed_at 정책(늦은 동기화 시 실제 완료시각), archived 과목의 진행 중 세션 정책, 마이그레이션 도입 여부, 테스트 스위트. Codex 감사 원문: 스크래치패드 `codex-audit-m0.md`.
