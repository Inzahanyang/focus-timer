# Focus Atlas

> **Your attention shapes a landscape.**
> 집중 시간을 추적하고 분석하는 풀스택 웹 앱 — 노마드코더 최종 졸업 과제.

한 번의 집중(25분)은 하나의 등고선(contour)으로 기록되고, 등고선이 쌓여 개인의 집중 지형이 됩니다.

**심사자용 2분 경험**: 접속 → `Explore a sample atlas` → `Try a 10-second demo session` → 완료 오버레이 → 자동 휴식 → Dashboard에서 방금 세션이 지형에 추가된 것 확인. (10초 데모는 실제 타이머와 같은 상태머신·같은 API를 씁니다)

## 스택

- **Frontend**: React (Vite) · React Router · Recharts → GitHub Pages
- **Backend**: Python Flask · SQLAlchemy → Railway
- **DB**: SQLite (로컬) / PostgreSQL (배포, `DATABASE_URL`)

## 과제 요구사항 체크리스트

- **Timer**: 25분 시작 ✓ 일시정지/재개 ✓ 리셋 ✓ 시각 진행 지표(등고선) ✓ 시작 전 과목 선택 ✓ 과목 생성·관리 ✓ 완료 자동 저장 ✓ 완료 알림(시각) ✓ 5분 휴식 자동 시작 ✓
- **History**: 전체 목록 ✓ 과목·시간·날짜 표시 ✓ 과목 필터 ✓ 주/월/전체 필터 ✓ 삭제 ✓
- **Dashboard**: 연속 일수 ✓ 전체 집중 시간 ✓ 이번 주 세션 수 ✓ 과목별 막대 차트 ✓ 요일별(월~일) 막대 차트 ✓ — 전부 서버 계산
- **API 7개**: subjects GET/POST/DELETE · sessions GET/POST/DELETE · stats GET ✓
- **배포**: GitHub Pages(React Router) ✓ Railway(gunicorn + PostgreSQL) ✓

## 아키텍처

```
브라우저 (React, HashRouter)
  TimerProvider ─ 라우트 위에서 타이머 소유 (이동해도 안 죽음)
  │  timerMachine: 순수 리듀서, 시간 진실 = endAt 파생값
  │  outbox: completionId 멱등 키로 저장 재시도
  ├─ Timer / History / Dashboard (Recharts 2 + 릿지라인 지형 SVG)
  └─ X-Client-ID · X-Timezone 헤더 (익명 기기 격리)
        │ HTTPS + CORS
Flask (Railway) ── PostgreSQL
  identity → 라우트(subjects/sessions/stats/demo) → 서비스(stats/insight)
  모든 쿼리 client_id 스코프 · 시간 저장 UTC · 경계 계산은 클라이언트 시간대
```

**타이머 신뢰성**: 남은 시간은 `ceil((endAt − now)/1000)`로 매번 파생 — interval은 화면 갱신용일 뿐이라 새로고침·백그라운드 스로틀링에도 안 틀어집니다. 완료는 프론트 completionId + 백엔드 `(client_id, idempotency_key)` unique + 요청 fingerprint로 정확히 1회 저장되고, 실패 시 아웃박스에 남아 재시도됩니다.

**데이터 격리**: 로그인 없이 `crypto.randomUUID()`를 기기에 저장하고 모든 요청에 `X-Client-ID`로 전송 — 공개 배포에서 방문자끼리 데이터가 섞이지 않습니다 (계정 시스템이 아닌 격리 레이어).

## API

| Method | Endpoint | 설명 |
|---|---|---|
| GET/POST/DELETE | `/subjects`, `/subjects/<id>` | 과목 (삭제는 soft delete — 과거 기록 보존) |
| GET/POST/DELETE | `/sessions`, `/sessions/<id>` | 세션 (`?subject_id=`, `?range=week\|month\|all`, POST는 Idempotency-Key 지원) |
| GET | `/stats` | streak · total_hours · sessions_this_week · by_subject · by_weekday (+insights 확장) |
| POST/DELETE | `/demo/seed`, `/demo` | 샘플 아틀라스 시드/제거 (is_demo만 건드림) |
| GET | `/health` | DB 포함 상태 확인 |

## 로컬 실행

```bash
# 백엔드 (http://localhost:5001)
cd backend
python3 -m venv .venv            # 최초 1회
.venv/bin/pip install -r requirements.txt
.venv/bin/python main.py

# 프론트엔드 (http://localhost:5173)
cd frontend
npm install
npm run dev
```

## 테스트

```bash
cd backend && .venv/bin/pytest          # 백엔드
cd frontend && npm test                 # 프론트엔드 35개
```

## 문서

| 문서 | 내용 |
|---|---|
| `docs/ASSIGNMENT.md` | 과제 원문 (판정 기준, 수정 금지) |
| `PRODUCT_SPEC.md` | 필수 요구사항 추적표 + 확장 기능 경계 + 고정 카피 |
| `docs/DESIGN_SYSTEM.md` | 디자인 시스템 (Attention Topography) |
| `DECISIONS.md` | 기술·디자인 결정 기록 |
| `AGENTS.md` / `CLAUDE.md` | 에이전트 협업 규칙 |

## 배포 (라이브)

- **Frontend**: https://inzahanyang.github.io/focus-timer/
- **Backend**: https://api-production-2e44.up.railway.app ([/health](https://api-production-2e44.up.railway.app/health))
- DB: Railway PostgreSQL — 재배포에도 데이터 유지 확인됨

### 프론트엔드 (GitHub Pages)

`main`에 push하면 `.github/workflows/deploy-pages.yml`이 lint → test → build → Pages 배포를 자동 실행한다.

사전 설정 (1회):
1. 리포 Settings → Pages → Source: **GitHub Actions**
2. 리포 변수 설정: `VITE_API_BASE_URL` = Railway 백엔드 URL (https)
   ```bash
   gh variable set VITE_API_BASE_URL --body "https://<railway-domain>"
   ```

워크플로가 프로덕션 번들에 `localhost`가 남아 있으면 실패하도록 검사한다.

### 백엔드 (Railway)

1. railway.com → New Project → **Deploy from GitHub repo** → `focus-timer` 선택
2. Settings → **Root Directory: `backend`** (railway.json이 gunicorn 시작·/health 헬스체크를 지정)
3. 같은 프로젝트에 **PostgreSQL** 추가 → 백엔드 서비스 Variables에서 `DATABASE_URL`을 Postgres 참조로 연결
4. 환경변수 추가:
   ```text
   ALLOWED_ORIGINS=https://inzahanyang.github.io
   ```
5. 배포 후 `https://<railway-domain>/health`가 `{"status":"ok","db":"ok"}`면 완료

로컬 SQLite는 개발 전용이다. Railway에서 `DATABASE_URL`이 없으면 컨테이너 재배포 때 데이터가 사라지므로 Postgres 연결이 필수다.
