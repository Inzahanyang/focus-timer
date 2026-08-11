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

## 배포

- Frontend: GitHub Pages — (배포 후 URL 기입)
- Backend: Railway — (배포 후 URL 기입, `/health`로 확인)

배포 절차·환경변수는 배포 시점에 이 섹션에 채운다.
