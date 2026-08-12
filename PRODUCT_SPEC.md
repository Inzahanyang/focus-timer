# Focus Atlas — Product Spec

> **Product:** Focus Atlas · *Your attention shapes a landscape.*
> **Concept:** Attention Topography — 한 번의 집중은 하나의 등고선(contour)을 남기고, 등고선이 쌓여 개인의 집중 지형이 된다.
> **폴더/리포명:** `focus-timer` · **표시명:** Focus Atlas
> **과제 판정 기준:** `docs/ASSIGNMENT.md` (원문 보존본)

앱이 하는 일은 세 가지다: ① 집중에 들어가게 한다 ② 집중하는 동안 방해하지 않는다 ③ 끝난 시간을 의미 있는 흔적으로 남긴다.

---

## 1. Assignment Core — 과제 필수 (하나라도 빠지면 미완성)

### Timer 화면

| # | 요구사항 | 구현 | 상태 |
|---|---|---|---|
| T1 | 25분 카운트다운 시작 | 기본 25:00, endAt 기반 | ⬜ |
| T2 | 일시정지·재개 | 상태머신 PAUSE/RESUME, 남은 시간 보존 | ⬜ |
| T3 | 리셋 | idle 복귀, 저장 안 함 | ⬜ |
| T4 | 시각적 진행 지표 | 닫혀가는 등고선(SVG), 파생값 기반 | ⬜ |
| T5 | 시작 전 과목 선택 | 과목 미선택 시 Begin focus 비활성 | ⬜ |
| T6 | 과목 목록 생성·관리 | Subjects CRUD (soft delete) | ⬜ |
| T7 | 완료 시 자동 저장 | POST /sessions, 멱등 키로 정확히 1회 | ⬜ |
| T8 | 종료 알림 (소리 또는 시각) | 시각 효과 항상 + 선택적 사운드 | ⬜ |
| T9 | 종료 후 5분 휴식 자동 시작 | FOCUS_ELAPSED → running_break | ⬜ |

### History 화면

| # | 요구사항 | 구현 | 상태 |
|---|---|---|---|
| H1 | 완료 세션 전체 목록 | GET /sessions, 최신순 | ⬜ |
| H2 | 과목·시간·날짜 표시 | 지층 행(과목명·분·완료시각 텍스트 병기) | ⬜ |
| H3 | 과목별 필터 | ?subject_id= | ⬜ |
| H4 | 날짜 범위 필터 (주/월/전체) | ?range=week\|month\|all, 로컬 시간대 기준 | ⬜ |
| H5 | 세션 삭제 | DELETE /sessions/<id> + 확인 대화상자 | ⬜ |

### Dashboard 화면

| # | 요구사항 | 구현 | 상태 |
|---|---|---|---|
| D1 | 연속 집중 일수 | 서버 계산 streak (표시명 continuity) | ⬜ |
| D2 | 전체 집중 시간 | 서버 계산 total_hours | ⬜ |
| D3 | 이번 주 세션 수 | 서버 계산, 로컬 월~일 | ⬜ |
| D4 | 과목별 막대 차트 | Recharts — "Where did your attention go?" | ⬜ |
| D5 | 요일별(월~일) 막대 차트 | Recharts — "When did focus take shape?" zero-fill | ⬜ |

### API (계약 고정 — 필드 제거·변경 금지, 추가만 허용)

| # | 엔드포인트 | 상태 |
|---|---|---|
| A1 | GET /subjects → `[{id, name}]` | ⬜ |
| A2 | POST /subjects `{name}` → 201 `{id, name}` | ⬜ |
| A3 | DELETE /subjects/<id> → `{success: true}` | ⬜ |
| A4 | GET /sessions (?subject_id, ?range) → `[{id, subject_id, subject_name, duration, created_at}]` | ⬜ |
| A5 | POST /sessions `{subject_id, duration}` → `{id, subject_id, duration, created_at}` | ⬜ |
| A6 | DELETE /sessions/<id> → `{success: true}` | ⬜ |
| A7 | GET /stats → `{streak, total_hours, sessions_this_week, by_subject, by_weekday}` | ⬜ |

### 기술 스택·배포

| # | 요구사항 | 상태 |
|---|---|---|
| S1 | React + React Router (Timer/History/Dashboard 3 라우트) | ⬜ |
| S2 | Recharts 막대 차트 2개 | ⬜ |
| S3 | Flask 백엔드 | ⬜ |
| S4 | GitHub Pages 프론트 배포 | ⬜ |
| S5 | Railway 백엔드 배포 (gunicorn main:app) | ⬜ |

---

## 2. Focus Atlas Extensions — 확장 (Core를 깨뜨리지 않는 범위에서만)

우선순위 순. 시간 부족 시 **아래쪽부터 제외**.

| 순위 | 기능 | 설명 |
|---|---|---|
| E0 | endAt 기반 타이머 신뢰성 | 절대 타임스탬프, 새로고침/백그라운드 복원 — 사실상 Core 취급 |
| E0 | X-Client-ID 기기 격리 | 공개 배포에서 리뷰어 데이터 분리 — 사실상 Core 취급 |
| E0 | 멱등 저장 | completionId + Idempotency-Key 이중 방어 — 사실상 Core 취급 |
| E1 | Demo Mode | 샘플 지형 시드 + 10초 데모 세션 (심사자 2분 검증 경로) |
| E2 | Atlas Notes | 결정론적 인사이트 (근거 병기, 데이터 부족 시 침묵) |
| E3 | Attention Topography 지형 | Dashboard 릿지라인 지형 (스트레치: 2D 등고선 지도) |
| E4 | 오프라인 아웃박스 | 저장 실패 시 로컬 큐 + 재시도 |
| E5 | 멀티탭 동기화 | storage 이벤트 기반 활성 타이머 표시 |
| E6 | Intention 한 줄 | 세션 의도 입력(선택) — note 필드 사용, 저장을 막지 않음 |

---

## 3. 언어 정책 (확정)

```
UI 언어: 영어 (v1 언어 전환 없음)
README·제출 설명: 한국어
코드·API·DB·테스트: 영어
날짜 표기: 영어 월 표기 + 24시간제 — 예: Aug 12, 2026 · 09:25
시간 계산: 브라우저 시간대 (X-Timezone), 저장은 UTC, 주 경계는 로컬 월~일
```

**문구 운영 원칙**
1. 기능 명칭·조작 버튼은 평범하고 명확한 영어: Timer, History, Dashboard, Start focus, Pause, Resume, Reset, This week, This month, All time, Delete session, Select a subject
2. 은유 언어는 다음 순간에만: 첫 화면 / 집중 시작 전 질문 / 완료 / 휴식 / 빈 대시보드 / Atlas Notes
3. 기능을 은유로 숨기지 않는다 (`Choose a terrain` ✕ → `Select a subject` ✓)
4. 과도하게 시적이거나 생산성 압박 문구 금지 (`Unlock your potential` ✕)
5. 사용자를 평가하지 않는다 (`You gave up` ✕ → `Session cleared. Begin again when ready.` ✓)

**고정 카피 (확정 — 변경 시 사용자 승인 필요)**

| 순간 | 카피 |
|---|---|
| Tagline | Your attention shapes a landscape. |
| 첫 화면 | FOCUS ATLAS / Your attention shapes a landscape. / Begin with one focused session. |
| 시작 전 질문 | What will receive your attention? |
| 시작 전 보조 | Choose a subject and set one clear intention. |
| 세션 완료 | A new contour has been added. |
| 휴식 | Let your attention widen. |
| 빈 대시보드 | Your map is still forming. / Complete three sessions to reveal your first pattern. |
| 인사이트 섹션 | ATLAS NOTE |
| History 제목 | Focus history / A record of where your attention has been. |
| Dashboard 제목 | Your focus landscape |
| 차트 1 | Where did your attention go? / Focus time by subject |
| 차트 2 | When did focus take shape? / Focus time from Monday to Sunday |
| 리셋 후 | Session cleared. Begin again when ready. |

접근성: 화면 표시는 `continuity`여도 aria-label은 `Current focus streak: N consecutive days`처럼 실제 의미를 풀어쓴다. 타이머는 `role="timer"` + 분 단위 polite 안내.

---

## 4. UX 흐름 요약

**Timer**: 과목 선택(+선택적 intention) → Begin focus → UI가 물러나고 등고선이 형성됨 → Pause 시 선이 끊김 → 완료 시 등고선이 닫히고 "A new contour has been added." (1~2초) → 자동 5분 휴식(이완 모드) → ready 복귀.

**History**: 날짜별 그룹, 지층 행(길이=시간, 색=과목, 텍스트 항상 병기), 필터 조합, 삭제 확인.

**Dashboard**: 상단 한 줄 통계(5 day continuity · 42.5 focused hours · 12 sessions this week) → 집중 지형 → 필수 차트 2개(질문형 제목) → Atlas Note.

**첫 방문**: 빈 대시보드 금지. FOCUS ATLAS 웰컴 + Create my first subject / Explore a sample atlas.

**심사자 데모 경로 (2분)**: 샘플 지형 확인 → 10초 데모 집중 → 등고선 완성 → Dashboard에 실제 반영 → Atlas Note 갱신.

---

## 5. 디자인 패스 2 (확정 지시 — 2026-08-12 리뷰)

베이스 디자인 채택, 전면 재설계 금지. 목표: **장식 추가가 아니라, 등고선이라는 하나의 형태를 모든 화면의 데이터 표현으로 확장.**

| # | 지시 | 시점 |
|---|---|---|
| 1 | History/Dashboard 점선 placeholder 제거 → 지층·릿지라인 기반 빈 상태 | sessions/stats와 함께 |
| 2 | 진행선이 실제 불규칙 등고선 경로를 따라 진행 (원형 게이지로 읽히지 않게: 트랙 가시성·폐곡선 3개·진폭 확대) | 즉시 |
| 3 | 과목색을 Timer→History→Dashboard에 일관 연결 (저채도) | 즉시(Timer)+내일(나머지) |
| 4 | 집중 화면에 intention 한 줄 유지 (이미 구현 — 대비만 상향) | 즉시 |
| 5 | 중앙 콘텐츠·등고선 스케일 10~20% 확대, 헤더 제외 수직 중심(정중앙보다 3~5% 위) | 즉시 |
| 6 | 리셋 메시지는 지속 텍스트가 아니라 2~3초 일시 문구 | 즉시 |
| 7 | 마우스 포커스 사각형 제거, `:focus-visible`로 분리 | 즉시 |
| 8 | Dashboard는 데이터 0이어도 필수 통계 3개 + 빈 차트 2개 표시, 지형만 "still forming" | stats와 함께 |
| 9 | Timer 첫 방문 + Dashboard 빈 상태에 "Explore a sample atlas" 노출 | demo seed와 함께 |
| 10 | 그림자·네온·강한 그라데이션·카드 남발 금지 (유지) | 상시 |

한 세션의 색 정체성: 과목 점 → 집중 등고선 → 완성 contour → History 지층 → Dashboard 능선.
