# Focus Atlas

> **Your attention shapes a landscape.**
> 집중 시간을 추적하고 분석하는 풀스택 웹 앱 — 노마드코더 최종 졸업 과제.

한 번의 집중(25분)은 하나의 등고선(contour)으로 기록되고, 등고선이 쌓여 개인의 집중 지형이 됩니다.

## 스택

- **Frontend**: React (Vite) · React Router · Recharts → GitHub Pages
- **Backend**: Python Flask · SQLAlchemy → Railway
- **DB**: SQLite (로컬) / PostgreSQL (배포, `DATABASE_URL`)

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
cd frontend && npm test                 # 프론트엔드 (추가 예정)
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
