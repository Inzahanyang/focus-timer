# 제출 정보 — Focus Atlas

## 링크

- **앱 (GitHub Pages)**: https://inzahanyang.github.io/focus-timer/
- **API (Railway)**: https://api-production-2e44.up.railway.app ([/health](https://api-production-2e44.up.railway.app/health))
- **저장소**: https://github.com/Inzahanyang/focus-timer

## 제출 문구 (디스코드/제출란에 붙여넣기)

---

**Focus Atlas** — Your attention shapes a landscape.

집중 시간을 추적·분석하는 풀스택 뽀모도로 앱입니다. 완료된 집중 세션이 하나의 등고선이 되어 개인의 "집중 지형"으로 쌓입니다.

🔗 https://inzahanyang.github.io/focus-timer/

**빠른 체험 (2분)**: 접속 → `Explore a sample atlas` (3주치 샘플 지형) → `Try a 10-second demo session` (실제 타이머와 같은 코드로 완료→자동 저장→5분 휴식 자동 시작까지 10초에 체험) → Dashboard에서 방금 세션이 지형에 추가된 것 확인.

**필수 기능**: 25분 타이머(시작/일시정지/재개/리셋), 등고선 진행 지표, 과목 관리, 완료 자동 저장, 완료 알림, 5분 휴식 자동 시작, History(과목·주/월/전체 필터·삭제), Dashboard(연속 일수·전체 시간·주간 세션 수·Recharts 차트 2개), Flask API 7개 전부 서버 계산, GitHub Pages + Railway(PostgreSQL) 배포.

**더 넣은 것들**:
- 새로고침·백그라운드에도 안 틀어지는 절대시각 기반 타이머 (setInterval 뺄셈 아님)
- 멱등 저장 (중복 저장 원천 차단) + 오프라인 아웃박스 (같은 탭에서는 저장이 실패해도 세션이 보존·재시도됨)
- 로그인 없이 기기별 데이터 격리 (방문자끼리 데이터 안 섞임)
- 주간 집중 지형(릿지라인) — 실제 세션의 요일×시간대 분포로 그려지는 커스텀 SVG
- Atlas Notes — 근거를 함께 표시하는 결정론적 패턴 분석 (외부 AI API 없음)
- Take a breathing pause — 원할 때 실행하는 1/3/5분 가이드 호흡 (기록에 안 섞임)

React + Flask + Recharts / 자동 테스트 105개 / 6주 동안 감사했습니다! 🎉

---

## 제출 전 최종 확인 목록

- [ ] 배포 링크 시크릿 창에서 열어 확인 (빈 상태 → 데모 경로)
- [ ] /health 응답 확인
- [ ] 제출 폼에 링크 입력
- [ ] (선택) 디스코드 미션인증 포럼 공유
