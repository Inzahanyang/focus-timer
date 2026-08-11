# CLAUDE.md — Focus Atlas 프로젝트 규칙

## 프로젝트

- 노마드코더 최종 졸업 과제. 마감 **2026-08-17(월) 06:00 KST**. 제출물 = 배포 링크.
- 판정 기준: `docs/ASSIGNMENT.md` (수정 금지). 스펙: `PRODUCT_SPEC.md`. 디자인: `docs/DESIGN_SYSTEM.md`. 결정 기록: `DECISIONS.md`.
- 폴더명 `focus-timer`, 제품 표시명 **Focus Atlas**.

## 역할 분담

- **Claude(Fable): 구현 책임자.** scaffold, 파일 작성·수정, React/Flask 구현, 테스트 실행, 리뷰 반영, 커밋, 배포, 최종 통합 판단.
- **Codex: read-only 감독자.** 감사·리뷰·테스트 설계·버그 탐색만. 규칙은 `AGENTS.md`.
- push는 사용자가 직접 실행한다 (커밋까지만 Claude).

## 협업 루프 (마일스톤마다)

```
Claude 구현 → Codex 감사(BLOCKER/MAJOR/MINOR/OPTIONAL) → Claude가 BLOCKER·MAJOR 수정
→ Codex 재검토 → Claude 커밋
```

## 원칙

1. **Assignment Core 우선.** 필수가 하나라도 빠지면 확장이 아무리 좋아도 미완성. 확장은 Core를 깨뜨리지 않는 방식으로만.
2. **필수 API 계약 고정.** 필드 추가만 허용, 제거·개명 금지.
3. 검증하지 않은 것을 "동작함"으로 보고하지 않는다. 빌드·테스트·curl·브라우저로 확인 후 보고.
4. 확장 우선순위 (부족하면 아래부터 버림): Demo Mode > Atlas Notes > 지형 시각화 > 오프라인 아웃박스 > 멀티탭.
5. 비자명한 결정은 `DECISIONS.md`에 기록.

## 기술 제약

- 백엔드: Python 3.9 호환 (로컬 시스템 파이썬). venv는 `backend/.venv`. 로컬 포트 **5001**.
- DB: 로컬 SQLite(`backend/instance/focus.db`), 배포 PostgreSQL(`DATABASE_URL`).
- 프론트: Vite + React(JS). HashRouter. 시간 진실은 endAt 파생값 — setInterval 누적 금지.
- UI 카피: PRODUCT_SPEC.md §3 고정 카피. 임의 변경 금지.

## 실행

```bash
# backend
cd backend && .venv/bin/python main.py            # http://localhost:5001

# frontend
cd frontend && npm run dev                         # http://localhost:5173

# Codex 감사 (read-only, 백그라운드)
codex exec -m gpt-5.6-sol -c model_reasoning_effort='"ultra"' \
  --sandbox read-only --cd . -o <결과파일.md> "<지시>"
```
