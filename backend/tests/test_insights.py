"""Atlas Notes: thresholds, evidence, tone (no fabrication, no judgment)."""

import uuid
from datetime import datetime, timedelta

import pytest

from app.extensions import db
from app.models import Session, Subject
from app.stats_service import compute_stats

CID = str(uuid.uuid4())
NOW_UTC = datetime(2026, 8, 12, 5, 0, 0)  # Wed 14:00 KST
# Local week: Mon Aug 10 00:00 KST == Aug 9 15:00 UTC
WEEK_START_UTC = datetime(2026, 8, 9, 15, 0, 0)


@pytest.fixture()
def subject_ids(app):
    with app.app_context():
        rows = [
            Subject(client_id=CID, name=name, normalized_name=name.casefold())
            for name in ("Work", "Reading")
        ]
        db.session.add_all(rows)
        db.session.commit()
        yield {row.name: row.id for row in rows}


def add(app, subject_ids, name, completed_utc, duration=25, with_start=True):
    with app.app_context():
        db.session.add(
            Session(
                client_id=CID,
                subject_id=subject_ids[name],
                subject_name_snapshot=name,
                duration=duration,
                started_at=(
                    completed_utc - timedelta(minutes=duration) if with_start else None
                ),
                completed_at=completed_utc,
            )
        )
        db.session.commit()


def insights(app):
    with app.app_context():
        return compute_stats(CID, "Asia/Seoul", NOW_UTC)["insights"]


def types(notes):
    return [note["type"] for note in notes]


def test_two_sessions_yield_onboarding_only(app, subject_ids):
    add(app, subject_ids, "Work", NOW_UTC - timedelta(hours=2))
    add(app, subject_ids, "Work", NOW_UTC - timedelta(hours=4))
    notes = insights(app)
    assert types(notes) == ["onboarding"]
    assert "2 sessions" in notes[0]["evidence"]


def test_never_more_than_three_notes(app, subject_ids):
    # Rich data satisfying many rules at once.
    for day in range(1, 15):
        add(
            app,
            subject_ids,
            "Work",
            datetime(2026, 8, 12, 0, 30, 0) - timedelta(days=day),  # 09:30 KST
            duration=50,
        )
    notes = insights(app)
    assert len(notes) <= 3
    assert all(note["evidence"] for note in notes)


def test_momentum_requires_both_weeks(app, subject_ids):
    # Only this week has sessions -> no trend note.
    for hours in (2, 4, 6):
        add(app, subject_ids, "Work", NOW_UTC - timedelta(hours=hours))
    assert "trend" not in types(insights(app))


def test_momentum_message_is_observational_when_down(app, subject_ids):
    # Last week: 4 sessions x 50 = 200 min. This week: 3 x 25 = 75 min.
    for day in (0, 1, 2, 3):
        add(
            app,
            subject_ids,
            "Work",
            WEEK_START_UTC - timedelta(days=day + 1, hours=5),
            duration=50,
        )
    for hours in (2, 20, 40):
        add(app, subject_ids, "Reading", NOW_UTC - timedelta(hours=hours))
    notes = insights(app)
    trend = next(note for note in notes if note["type"] == "trend")
    assert "less recorded focus" in trend["message"]
    # tone check: no blame words
    assert "lazy" not in trend["message"].lower()
    assert "%" in trend["evidence"]


def test_time_window_threshold_and_evidence(app, subject_ids):
    # 8 recent sessions, all starting 09:30 KST (00:30 UTC) -> 09:00-12:00.
    for day in range(1, 9):
        add(
            app,
            subject_ids,
            "Work",
            datetime(2026, 8, 12, 0, 55, 0) - timedelta(days=day),
        )
    notes = insights(app)
    window = next(note for note in notes if note["type"] == "time_window")
    assert "09:00–12:00" in window["message"]
    assert "8 of your last 8" in window["evidence"]


def test_no_time_window_without_start_times(app, subject_ids):
    for day in range(1, 9):
        add(
            app,
            subject_ids,
            "Work",
            datetime(2026, 8, 12, 0, 55, 0) - timedelta(days=day),
            with_start=False,
        )
    assert "time_window" not in types(insights(app))


def test_subject_concentration_requires_dominance(app, subject_ids):
    # 50/50 split -> no subject note.
    for day in (1, 2, 3):
        add(app, subject_ids, "Work", NOW_UTC - timedelta(days=day, hours=1))
        add(app, subject_ids, "Reading", NOW_UTC - timedelta(days=day, hours=3))
    assert "subject" not in types(insights(app))
