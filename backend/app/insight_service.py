"""Atlas Notes — deterministic, evidence-backed observations (master plan §11).

Not a chatbot, not an external AI API: pure rules over the client's own
sessions. Every note carries its evidence; below the data thresholds the
engine stays silent rather than fabricating a pattern. The tone observes,
never judges (PRODUCT_SPEC §3).
"""

from collections import defaultdict
from datetime import timedelta, timezone
from zoneinfo import ZoneInfo

from .time_utils import utc_bounds_for_range

WEEKDAY_NAMES = (
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
)

_CONFIDENCE_SCORE = {"high": 3, "medium": 2, "low": 1}


def _note(kind, title, message, evidence, confidence, action):
    return {
        "type": kind,
        "title": title,
        "message": message,
        "evidence": evidence,
        "confidence": confidence,
        "action": action,
    }


def compute_insights(sessions, tz_name, now_utc, streak):
    """`sessions` are the client's non-deleted Session rows. Returns at
    most three notes, strongest evidence first."""
    tz = ZoneInfo(tz_name)
    n = len(sessions)

    # 0–2 sessions: onboarding only — no false precision (§11.3).
    if n <= 2:
        return [
            _note(
                "onboarding",
                "Your map is still forming",
                "Complete three sessions to reveal a reliable pattern.",
                "{} session{} recorded so far".format(n, "" if n == 1 else "s"),
                "high",
                "Start with one 25-minute session today.",
            )
        ]

    notes = []

    # 1) Momentum — this local week vs the previous one, only when both
    #    weeks carry enough data to compare honestly.
    week_start, week_end = utc_bounds_for_range("week", tz_name, now_utc)
    prev_start, prev_end = utc_bounds_for_range(
        "week", tz_name, week_start - timedelta(seconds=1)
    )
    this_week = [s for s in sessions if week_start <= s.completed_at < week_end]
    last_week = [s for s in sessions if prev_start <= s.completed_at < prev_end]
    if len(this_week) >= 3 and len(last_week) >= 3:
        this_min = sum(s.duration for s in this_week)
        last_min = sum(s.duration for s in last_week)
        if last_min > 0 and this_min != last_min:
            percent = round((this_min - last_min) / last_min * 100)
            if percent > 0:
                message = "Your week is gaining momentum."
                action = "Protect one more session before the week ends."
            else:
                # Observation, not judgment.
                message = "This week holds less recorded focus than last week."
                action = "One 25-minute session narrows the gap."
            notes.append(
                _note(
                    "trend",
                    "Week over week",
                    message,
                    "{} min so far vs {} min last week ({:+d}%)".format(
                        this_min, last_min, percent
                    ),
                    "high",
                    action,
                )
            )

    # 2) Continuity — celebrate an active streak, never scold a broken one.
    if streak >= 2:
        notes.append(
            _note(
                "streak",
                "Continuity",
                "Your line is unbroken for {} days.".format(streak),
                "At least one completed session on each of the last {} days".format(
                    streak
                ),
                "high",
                "One session today keeps the line going.",
            )
        )

    # 3) Focus window — 8+ recent sessions with real start times (§11.3).
    recent_starts = [
        s.started_at.replace(tzinfo=timezone.utc).astimezone(tz)
        for s in sessions
        if s.started_at is not None
        and s.completed_at >= now_utc - timedelta(days=14)
    ]
    if len(recent_starts) >= 8:
        buckets = defaultdict(int)
        for start in recent_starts:
            buckets[start.hour // 3] += 1
        top_bucket, top_count = max(buckets.items(), key=lambda kv: (kv[1], -kv[0]))
        share = top_count / len(recent_starts)
        if share >= 0.4:
            hour = top_bucket * 3
            window = "{:02d}:00–{:02d}:00".format(hour, hour + 3)
            notes.append(
                _note(
                    "time_window",
                    "Focus window",
                    "Your most consistent focus window is {}.".format(window),
                    "{} of your last {} sessions began in this window".format(
                        top_count, len(recent_starts)
                    ),
                    "high" if share >= 0.5 else "medium",
                    "Try protecting the same window tomorrow.",
                )
            )

    # 4) Weekly rhythm — needs 5+ sessions spread over 3+ distinct days.
    recent = [
        (s, s.completed_at.replace(tzinfo=timezone.utc).astimezone(tz))
        for s in sessions
        if s.completed_at >= now_utc - timedelta(days=28)
    ]
    distinct_days = {local.date() for _, local in recent}
    if len(recent) >= 5 and len(distinct_days) >= 3:
        per_weekday = defaultdict(int)
        for s, local in recent:
            per_weekday[local.weekday()] += s.duration
        top_weekday, top_minutes = max(
            per_weekday.items(), key=lambda kv: (kv[1], -kv[0])
        )
        total_minutes = sum(per_weekday.values())
        if total_minutes > 0 and top_minutes / total_minutes >= 0.3:
            notes.append(
                _note(
                    "weekday",
                    "Weekly rhythm",
                    "Focus has settled most on {}s.".format(
                        WEEKDAY_NAMES[top_weekday]
                    ),
                    "{} of {} recorded minutes in the last four weeks".format(
                        top_minutes, total_minutes
                    ),
                    "medium",
                    "A rhythm you can plan around.",
                )
            )

    # 5) Subject concentration — only when one subject clearly dominates.
    per_subject = defaultdict(int)
    names = {}
    for s in sessions:
        per_subject[s.subject_id] += s.duration
        names[s.subject_id] = s.subject_name_snapshot
    total = sum(per_subject.values())
    top_subject, top_min = max(per_subject.items(), key=lambda kv: (kv[1], -kv[0]))
    if total > 0 and len(per_subject) >= 2 and top_min / total >= 0.6:
        notes.append(
            _note(
                "subject",
                "Where attention lives",
                "Most of your attention lives in {}.".format(names[top_subject]),
                "{} of {} recorded minutes ({}%)".format(
                    top_min, total, round(top_min / total * 100)
                ),
                "medium",
                "The map only shows where you are — no change required.",
            )
        )

    # Rank: evidence strength first, current-week relevance as tiebreaker.
    def score(note):
        relevance = 1 if note["type"] in ("trend", "streak") else 0
        return (_CONFIDENCE_SCORE[note["confidence"]], relevance)

    notes.sort(key=score, reverse=True)
    return notes[:3]
