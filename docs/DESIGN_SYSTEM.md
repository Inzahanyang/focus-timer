# Focus Atlas — Design System

> 이 문서가 모든 화면·컴포넌트·모션·문구의 기준이다.
> 원칙: **한 번의 집중이 하나의 흔적을 남긴다.** 메타포는 지형(topography) 하나로 통일한다. 우주(orbit/constellation) 계열 시각 언어는 사용하지 않는다.

## 0. 상태 문법 — 모든 화면을 관통하는 규칙

```
집중 전        아직 그려지지 않은 지형
집중 중        하나의 등고선이 형성되는 과정
일시정지       끊어진 등고선
집중 완료      완성된 등고선
휴식           지형이 이완되는 시간
History        등고선이 시간순으로 쌓인 지층
Dashboard      모든 흔적이 합쳐진 집중 지형
Atlas Note     지형을 해석한 관찰 기록
```

분위기 단어: 고요함 · 정확함 · 여백 · 관찰 · 축적
금지: 게임 / 경쟁 / 보상 / 네온 / 사이버펑크 / 귀여움 / 생산성 압박 / confetti / 챗봇

## 1. 모드 (3개)

CSS 변수 스왑으로 구현: `<html data-mode="paper|focus|break">`. 라우트 이동이 아니라 같은 화면 안에서 조용히 전환된다(400ms).

| 모드 | 언제 | 성격 |
|---|---|---|
| `paper` | 기본, 시작 전, History, Dashboard | 따뜻한 종이 회백색, 먹색 텍스트 |
| `focus` | running_focus / paused_focus | 깊은 잉크색(남청 흑색), UI 존재감 최소화 |
| `break` | running_break | 안개 낀 청회색, 낮은 대비, 이완 |

## 2. 색 토큰

```css
/* paper (기본) */
--bg: #f4f2ec;        /* 따뜻한 종이 */
--surface: #fbfaf6;
--text: #1c1d19;      /* 먹색 */
--muted: #71736a;
--line: #ddd9cd;      /* 미세한 회색 선 */
--contour: #3c4656;   /* 등고선 잉크 */

/* focus */
--bg: #10151d;        /* 잉크 남청 흑색 */
--surface: #151b25;
--text: #e8e6df;
--muted: #8a919e;
--line: #262e3b;
--contour: #b7c6da;

/* break */
--bg: #e6ebe9;        /* 안개 청회 */
--surface: #eef2f0;
--text: #333d3a;
--muted: #7c8683;
--line: #cfd8d4;
--contour: #7fa198;
```

**과목 팔레트 — 지질 표본** (원색 금지, 색은 재질 구분 수단. 색만으로 과목 구분 금지 — 텍스트 항상 병기)

```css
--geo-1: #4a5b6e;  /* slate — 청회암 */
--geo-2: #a97e3f;  /* ochre — 황토 */
--geo-3: #66794e;  /* moss — 이끼 */
--geo-4: #9a5a44;  /* iron — 적갈 */
--geo-5: #8a6f5c;  /* clay — 점토 */
--geo-6: #55565e;  /* basalt — 현무암 */
--geo-7: #7d8a6a;  /* lichen — 지의류 */
--geo-8: #b1976b;  /* sandstone — 사암 */
```

과목 색은 `subject.id % 8`로 결정론적 배정.

## 3. 타이포그래피

- 시스템 산세리프 스택. 원격 폰트 의존 금지.
- 타이머 숫자: `font-variant-numeric: tabular-nums` 필수. 미래적 디지털 폰트 금지.
- 작은 라벨(SUBJECT, ATLAS NOTE 등): 대문자 + `letter-spacing: 0.18em` — 편집 디자인의 밀도는 자간·정렬·여백에서 나온다.
- 화면당 타이머 제외 3단계 이하의 크기 위계.

## 4. 모션 규칙

```
버튼            150–200ms
화면/모드 전환   300–500ms
집중 진행       시간과 정확히 비례하는 선형 진행 (이징 금지)
완료 효과       1초 안팎, 절제
휴식            정적 등고선 (D34) — 호흡 모션은 독립 Guided Breathing에만
```

- 반복 장식 애니메이션 금지. 집중 중 움직이는 것은 등고선 진행뿐.
- `prefers-reduced-motion`: 모든 전환·호흡 제거, 진행 표시는 유지.

## 5. 등고선 프리미티브 (ContourRing)

- SVG 폐곡선. 완전한 원이 아니라 **미세하게 불규칙한 등고선** — 시드 기반 반경 섭동(과목 id가 시드) → 세션마다 형태가 조금씩 다르되 결정론적.
- `pathLength=1` + `stroke-dasharray`로 진행률만큼 선이 그려진다. **진행의 진실은 endAt 파생값** — 애니메이션이 아니라 시간이 선을 그린다.
- 시작: 선의 일부만 존재(◜) → 완료: 폐곡선(◯).
- 일시정지: 진행 정지 + 선 투명도 하락 — 열린 틈 자체가 중단을 말한다. 텍스트는 기능만("Focus paused").
- 내부에 아주 옅은 보조 등고선 1개(정적) — 지도 질감.
- 휴식: break 팔레트의 정적 등고선 (D34). 확장·수축 호흡은 독립 Guided Breathing 전용.
- 접근성: `role="progressbar"` + aria-valuemin/max/now, 시간은 별도 `role="timer"` 요소.

## 6. 화면 골격

**Timer (시작 전, paper)** — 중앙 정렬 단일 컬럼:
```
What will receive your attention?
[subject chips or select]
Intention — optional [___________]
25 minutes
[ Begin focus ]
```

**Timer (집중 중, focus)** — 내비게이션·카드가 물러나고(투명도 하락) 중앙에만:
```
READING          ← 과목, 대문자 라벨
    (등고선)
   18:42          ← tabular, 크지만 절제
Finish the first draft   ← intention (있을 때만, muted)
[ Pause ] [ Reset ]
```
큰 숫자로 소리치지 않는다. 몇 분 후 화면의 존재를 잊게 만드는 것이 목표.

**완료 오버레이 (1~2초, 휴식을 막지 않음)**:
```
A new contour has been added.
Reading · 25 minutes
```

**Break (break 모드)**:
```
BREAK
Let your attention widen.
04:32
[ Pause ] [ Skip break ]
```
호흡 강요, 생산성 조언, 새 미션 금지.

**History (paper)** — 날짜 헤더 + 지층 행:
```
AUG 12
09:00  WORK      25m  ━━━━━━━━━
11:30  READING   25m  ━━━━━━━━━
```
선 길이=시간, 색=과목, 텍스트 항상 병기. 삭제는 확인 후("Delete this session? This action cannot be undone.") — 시적 문구 금지.

**Dashboard (paper)**:
```
Your focus landscape
5 day continuity · 42.5 focused hours · 12 sessions this week
[집중 지형 — 릿지라인]
Where did your attention go? (Recharts bar)
When did focus take shape? (Recharts bar)
ATLAS NOTE
```
거대 스탯 카드 3개 금지 — 한 줄 문장형. streak는 화면에서 continuity로 표기하되 보조 설명과 aria로 의미 고정.

**지형(릿지라인)**: 월~일 7개 능선, 각 능선은 시간대별 집중 밀도 곡선. 실데이터 매핑(높이=분, 색=지배 과목). 데이터가 적으면 낮고 조용한 지형이 되며 그 자체로 자연스럽다. 빈 상태: "Your map is still forming."

## 7. 문구

PRODUCT_SPEC.md §3의 고정 카피와 운영 원칙을 따른다. 요약: 기능은 명료하게, 목소리는 시작·완료·축적·해석의 순간에만. 짧고 관찰적인 문장. 사용자를 평가하지 않는다.
