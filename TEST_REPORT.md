# TEST_REPORT — Focus Atlas

> 최종 검증: 2026-08-13 (제출 전). 자동 테스트는 로컬, 수동/스모크는 실배포 주소에서 수행.
> Codex 최종 감사(제출 전): BLOCKER 0 · 제출 가능 판정. MAJOR 1건(멀티탭 outbox 덮어쓰기)은 확장(E5) 범위로 v1.1 이월.

## 자동 테스트

| 스위트 | 개수 | 결과 | 실행 |
|---|---|---|---|
| 백엔드 pytest | 70 (subjects/sessions/stats/insights/demo/time_utils/config/fixed-clock) | 전부 통과 | `cd backend && .venv/bin/pytest` |
| 프론트 vitest | 35 (타이머 리듀서 20 · 지형 수학 9 · 호흡 6) | 전부 통과 | `cd frontend && npm test` |
| 린트 | oxlint | 경고 0 | `npm run lint` |
| 프로덕션 빌드 | vite build | 통과 (번들 내 localhost 금지 검사는 Pages 워크플로의 별도 step) | `npm run build` |

핵심 자동 커버리지:
- 타이머: 만료 경계(±1ms) × Pause/Reset × 집중/휴식, outbox 격리(A 미저장 중 B 완료), 휴식 anchor, reconcile 4경로
- 세션 API: 멱등 재전송(같은 키+같은 내용=재생, 다른 내용=409), soft delete 후 재시도 부활 방지, 소유권/격리, 주·월 반개구간
- 통계: streak(오늘/어제 앵커/공백), half-up 반올림 표, 고정 시계 경계(DST 167/169h 주, UTC±극단), 삭제 세션 제외
- 지형: 주 경계 clip(월요일 00:10 세션이 이번 주 일요일을 칠하지 않음), 자정 분할, 스무딩 무순환
- 인사이트: 임계값(2세션→온보딩만), 근거 필수, 비평가 톤

## 실배포 스모크 (Pages ↔ Railway)

| 항목 | 결과 |
|---|---|
| 프론트 로드 + 콘솔 에러 | 200, 에러 0 |
| CORS preflight (Pages origin) | 200, 정확한 origin 허용 |
| 샘플 아틀라스 시드 (멱등) | 정상 |
| 10초 데모 세션 (1클릭, Work 고정) | 완료 오버레이 → 자동 5분 휴식 → Postgres 실저장 |
| History 필터/삭제 | 정상 |
| 딥링크 새로고침 (#/dashboard 직접 리로드) | 404 없음 (HashRouter) |
| **백엔드 재배포 후 데이터 생존** | streak/통계 그대로 (PostgreSQL) |
| 좁은 뷰포트 (~600px 유효폭) | 3개 라우트 가로 스크롤 0, 지형·차트 렌더 |

## 수동 회복탄력성 매트릭스

| 시나리오 | 결과 |
|---|---|
| 집중 중 새로고침 | 파생 시간으로 정확히 이어짐 (리로드 중에도 시간 흐름) |
| 일시정지 중 새로고침 | 남은 시간 그대로 복원 |
| 자리 비운 사이 집중 완료 | 정확히 1회 저장 + 이론적 종료+5분에 anchor된 휴식, 휴식까지 지났으면 "completed while away" |
| History 화면에 머문 채 완료 | 라우트 밖에서도 저장·휴식 처리, 목록 자동 갱신 |
| 손상된 localStorage | phase 검증 실패 시 idle 복구, 유효한 outbox는 회수·재전송 |
| 저장 실패(오프라인) | outbox 유지, "Saved on this device — syncing", online 복귀 시 재시도 |
| 호흡 일시정지/새로고침 | 위상·시계 동결 / 주기 중간 복원 |
| 마우스 클릭 포커스 박스 | 없음 (:focus-visible 분리) |
| prefers-reduced-motion | 전환·호흡 스케일 제거, 진행 표시는 유지 |

## 알려진 한계

- 멀티탭 동기화 없음(스트레치 항목) — 중복 저장은 서버 멱등 키가 차단하지만, 두 탭이 같은 저장 키를 쓰므로 드문 시나리오(오프라인 완료 직후 다른 오래된 탭이 상태를 덮어쓰는 경우)에서 미전송 outbox가 유실될 수 있음. 오프라인 보존 보장은 **단일 탭 기준**. v1.1에서 outbox 저장 분리+병합으로 해결 예정
- 소리/브라우저 알림 미구현 — 과제는 "소리 **또는** 시각 효과"이며 시각 효과(완료 오버레이)로 충족

