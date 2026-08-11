# Focus Timer — 과제 원문 (보존본)

> 노마드코더 최종 졸업 과제 공지 원문. **이 파일의 내용은 수정하지 않는다.**
> 모든 요구사항 판정은 이 문서를 기준으로 한다.

---

7일간의 챌린지입니다! 최종 졸업 과제입니다.

오늘의 과제: 아래 과제를 지시사항에 따라 수행합니다.

제출기간: 7일 챌린지! 월요일 오전 6시까지

## 챌린지 목표

그동안 배운 내용을 총동원해 집중 시간을 추적하고 분석하는 풀스택 웹 앱을 만드세요.

뽀모도로 타이머로 집중 세션을 진행하고, 과목별로 태그를 붙이고, 대시보드에서 패턴을 확인합니다.

## 챌린지 조건

### Timer 화면

- 유저는 25분 카운트다운 타이머를 시작할 수 있습니다.
- 유저는 타이머를 일시정지하고 재개할 수 있습니다.
- 유저는 타이머를 리셋할 수 있습니다.
- 유저는 타이머가 작동하는 동안 시각적 진행 지표를 볼 수 있습니다.
- 유저는 집중 세션을 시작하기 전에 과목을 선택할 수 있습니다.
- 유저는 과목 목록을 만들고 관리할 수 있습니다 (예: "Work", "Reading", "Exercise", "Study").
- 집중 세션이 완료되면 자동으로 저장됩니다.
- 타이머가 종료되면 유저에게 알림이 표시됩니다 (소리 또는 시각 효과).
- 집중 세션이 끝난 후, 5분 휴식 타이머가 자동으로 시작됩니다.

### History 화면

- 유저는 완료된 모든 집중 세션의 목록을 볼 수 있습니다.
- 각 세션은 과목, 시간, 날짜를 표시합니다.
- 유저는 과목별로 세션을 필터링할 수 있습니다.
- 유저는 날짜 범위로 세션을 필터링할 수 있습니다 (이번 주 / 이번 달 / 전체).
- 유저는 세션을 삭제할 수 있습니다.

### Dashboard 화면

- 유저는 현재 집중 연속 기록(연속 일수)을 볼 수 있습니다.
- 유저는 전체 집중한 시간을 볼 수 있습니다.
- 유저는 이번 주에 완료한 세션 수를 볼 수 있습니다.
- 유저는 과목별 집중 시간을 막대 차트로 볼 수 있습니다.
- 유저는 주간 패턴(월~일)을 막대 차트로 볼 수 있습니다.

## 기술 스펙

### Tech Stack

- Frontend: React, HTML/CSS, JavaScript
- Backend: Python (Flask)
- Charts: Recharts

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /subjects | 모든 과목 목록 |
| POST | /subjects | 새 과목 생성 |
| DELETE | /subjects/\<id\> | 과목 삭제 |
| GET | /sessions | 세션 목록 (필터 지원) |
| POST | /sessions | 완료된 세션 저장 |
| DELETE | /sessions/\<id\> | 세션 삭제 |
| GET | /stats | 대시보드 통계 |

### GET /subjects

```json
[
  { "id": 1, "name": "Work" },
  { "id": 2, "name": "Reading" }
]
```

### POST /subjects

```json
// Request
{ "name": "Exercise" }

// Response
{ "id": 3, "name": "Exercise" }
```

### DELETE /subjects/\<id\>

```json
{ "success": true }
```

### GET /sessions

Query parameters:

- subject_id — 과목별 필터 (예: ?subject_id=1)
- range — 날짜 범위 (week, month, all)

```json
[
  {
    "id": 1,
    "subject_id": 1,
    "subject_name": "Work",
    "duration": 25,
    "created_at": "2026-04-20T14:30:00"
  }
]
```

### POST /sessions

```json
// Request
{
  "subject_id": 1,
  "duration": 25
}

// Response
{
  "id": 1,
  "subject_id": 1,
  "duration": 25,
  "created_at": "2026-04-20T14:30:00"
}
```

### DELETE /sessions/\<id\>

```json
{ "success": true }
```

### GET /stats

모든 통계는 서버에서 계산됩니다.

```json
{
  "streak": 5,
  "total_hours": 42.5,
  "sessions_this_week": 12,
  "by_subject": [
    { "name": "Work", "minutes": 600 },
    { "name": "Reading", "minutes": 450 }
  ],
  "by_weekday": {
    "Mon": 45,
    "Tue": 60,
    "Wed": 30,
    "Thu": 50,
    "Fri": 25,
    "Sat": 80,
    "Sun": 70
  }
}
```

### Frontend Notes

- Timer: setInterval로 카운트다운, React state로 타이머 상태 관리, localStorage로 페이지 새로고침 후에도 타이머 상태 유지, CSS 애니메이션으로 진행 지표
- History: useEffect로 API 호출, React state로 필터
- Dashboard: Recharts로 막대 차트
- Routing: 3개 화면에 React Router

### Deployment

Frontend (GitHub Pages):

React 앱을 빌드하여 GitHub Pages에 배포합니다.

```bash
npm run build
npm install -g gh-pages
gh-pages -d build
```

Backend (Railway):

Flask API는 Railway에 배포합니다. (30일 무료)

requirements.txt가 필요합니다:

```text
flask
flask-cors
gunicorn
```

프로젝트 루트에 railway.json을 추가하세요:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "deploy": {
    "startCommand": "gunicorn main:app"
  }
}
```

(main은 Python 파일 이름에 맞게 교체하세요.)

배포:

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

## 사이드 퀘스트 (선택사항)

완성한 졸업작품을 디스코드 미션인증 포럼에 올려주세요!

6주간 함께한 동료들에게 졸업작품을 공유해 보아요. 🎉

## 제출방법

제출기간: 7일 챌린지! 월요일 오전 6시까지

배포한 작업물의 링크를 제출해 주세요.

6주 동안 정말 수고 많으셨습니다!
