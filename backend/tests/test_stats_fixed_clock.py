"""compute_stats() against a FIXED clock — boundaries that wall-clock
tests cannot pin down (audit MINOR-3). Sessions are inserted directly;
the API layer is covered elsewhere."""

import uuid
from datetime import datetime, timedelta

import pytest

from app.extensions import db
from app.models import Session, Subject
from app.stats_service import compute_stats

CID = str(uuid.uuid4())

# Fixed "now": Wednesday 2026-08-12 14:00 KST == 05:00 UTC.
NOW_UTC = datetime(2026, 8, 12, 5, 0, 0)
# Local week: Mon 2026-08-10 00:00 KST (= Aug 9 15:00 UTC) .. Mon Aug 17.
WEEK_START_UTC = datetime(2026, 8, 9, 15, 0, 0)


@pytest.fixture()
def seeded(app):
    with app.app_context():
        subject = Subject(client_id=CID, name="Work", normalized_name="work")
        db.session.add(subject)
        db.session.commit()
        yield subject.id


def add_session(app, subject_id, completed_at_utc, duration=25, deleted=False):
    with app.app_context():
        row = Session(
            client_id=CID,
            subject_id=subject_id,
            subject_name_snapshot="Work",
            duration=duration,
            completed_at=completed_at_utc,
            idempotency_key=str(uuid.uuid4()),
            deleted_at=NOW_UTC if deleted else None,
        )
        db.session.add(row)
        db.session.commit()


def stats(app, tz="Asia/Seoul"):
    with app.app_context():
        return compute_stats(CID, tz, NOW_UTC)


def test_exact_week_boundaries_half_open(app, seeded):
    add_session(app, seeded, WEEK_START_UTC)  # Mon 00:00 KST — inclusive
    add_session(app, seeded, WEEK_START_UTC - timedelta(seconds=1))  # Sun 23:59:59 — out
    result = stats(app)
    assert result["sessions_this_week"] == 1
    assert result["by_weekday"]["Mon"] == 25
    assert sum(result["by_weekday"].values()) == 25


def test_weekday_attribution_uses_local_day(app, seeded):
    # Tue 00:30 KST == Mon 15:30 UTC — must count as Tue locally.
    add_session(app, seeded, datetime(2026, 8, 10, 15, 30, 0))
    result = stats(app)
    assert result["by_weekday"]["Tue"] == 25
    assert result["by_weekday"]["Mon"] == 0


def test_zero_fill_on_partially_filled_week(app, seeded):
    add_session(app, seeded, datetime(2026, 8, 11, 1, 0, 0))  # Tue 10:00 KST
    result = stats(app)
    weekdays = list(result["by_weekday"].items())
    assert [d for d, _ in weekdays] == ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    assert [m for _, m in weekdays] == [0, 25, 0, 0, 0, 0, 0]


def test_half_up_rounding_policy(app, seeded):
    # 9 minutes = 0.15h -> half-up 0.2 (banker's would give 0.1)
    add_session(app, seeded, datetime(2026, 8, 12, 3, 0, 0), duration=9)
    assert stats(app)["total_hours"] == 0.2


@pytest.mark.parametrize(
    "minutes,expected",
    [(3, 0.1), (9, 0.2), (15, 0.3), (21, 0.4), (27, 0.5), (33, 0.6)],
)
def test_half_up_rounding_table(app, seeded, minutes, expected):
    add_session(app, seeded, datetime(2026, 8, 12, 3, 0, 0), duration=minutes)
    assert stats(app)["total_hours"] == expected


def test_streak_across_utc_midnight(app, seeded):
    # Sessions at 08:00 KST Wed/Tue/Mon == 23:00 UTC the PREVIOUS calendar
    # day — local-day attribution must still see three consecutive days.
    for day in (9, 10, 11):  # UTC Aug 9/10/11 23:00 = KST Aug 10/11/12 08:00
        add_session(app, seeded, datetime(2026, 8, day, 23, 0, 0))
    assert stats(app)["streak"] == 3


def test_deleted_sessions_are_invisible(app, seeded):
    add_session(app, seeded, datetime(2026, 8, 12, 3, 0, 0), deleted=True)
    result = stats(app)
    assert result["total_hours"] == 0.0
    assert result["sessions_this_week"] == 0
    assert result["by_subject"] == []


def test_streak_in_extreme_timezone(app, seeded):
    # Same UTC instants, different local calendar. UTC-10 (Pacific/Honolulu):
    # Aug 12 04:00 UTC == Aug 11 18:00 local — "today" is Aug 11 locally
    # (NOW is Aug 11 19:00 local), so one session today -> streak 1.
    add_session(app, seeded, datetime(2026, 8, 12, 4, 0, 0))
    assert stats(app, tz="Pacific/Honolulu")["streak"] == 1
