"""Server-side dashboard statistics.

Everything is computed from completed, non-deleted sessions in the
client's local timezone (D6), reusing the same boundary helper as
GET /sessions so History and Dashboard can never disagree.

Definitions (assignment + master plan §9.7):
- total_hours: all-time minutes / 60, rounded to one decimal
- sessions_this_week: local Monday–Sunday count
- by_subject: all-time minutes per subject, descending; archived subject
  names survive via the snapshot (extension: subject_id for color mapping)
- by_weekday: current week Mon–Sun minutes, always zero-filled
- streak: consecutive local days with >= 1 session; today may be empty —
  yesterday still anchors the streak because today is not over
"""

from datetime import timedelta, timezone
from zoneinfo import ZoneInfo

from .models import Session
from .time_utils import utc_bounds_for_range

WEEKDAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


def _to_local(naive_utc, tz):
    return naive_utc.replace(tzinfo=timezone.utc).astimezone(tz)


def compute_stats(client_id, tz_name, now_utc):
    tz = ZoneInfo(tz_name)
    # Assignment scale: one client's sessions fit comfortably in memory,
    # and one pass covers four aggregates.
    sessions = Session.query.filter_by(
        client_id=client_id, deleted_at=None
    ).all()

    total_minutes = sum(s.duration for s in sessions)

    week_start, week_end = utc_bounds_for_range("week", tz_name, now_utc)
    by_weekday = {day: 0 for day in WEEKDAYS}
    sessions_this_week = 0
    for s in sessions:
        if week_start <= s.completed_at < week_end:
            sessions_this_week += 1
            local = _to_local(s.completed_at, tz)
            by_weekday[WEEKDAYS[local.weekday()]] += s.duration

    per_subject = {}
    for s in sessions:
        entry = per_subject.get(s.subject_id)
        if entry is None:
            entry = {
                "name": s.subject_name_snapshot,
                "minutes": 0,
                "latest": s.completed_at,
            }
            per_subject[s.subject_id] = entry
        entry["minutes"] += s.duration
        if s.completed_at >= entry["latest"]:
            entry["latest"] = s.completed_at
            entry["name"] = s.subject_name_snapshot
    by_subject = [
        # subject_id is an additive extension: the frontend keeps one color
        # per subject across timer, history, and charts.
        {"name": entry["name"], "minutes": entry["minutes"], "subject_id": sid}
        for sid, entry in per_subject.items()
    ]
    by_subject.sort(key=lambda item: (-item["minutes"], item["name"]))

    session_dates = {_to_local(s.completed_at, tz).date() for s in sessions}
    today = _to_local(now_utc, tz).date()
    if today in session_dates:
        anchor = today
    elif (today - timedelta(days=1)) in session_dates:
        anchor = today - timedelta(days=1)
    else:
        anchor = None
    streak = 0
    day = anchor
    while day is not None and day in session_dates:
        streak += 1
        day = day - timedelta(days=1)

    return {
        "streak": streak,
        "total_hours": round(total_minutes / 60, 1),
        "sessions_this_week": sessions_this_week,
        "by_subject": by_subject,
        "by_weekday": by_weekday,
    }
