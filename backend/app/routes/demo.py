"""Sample atlas for reviewers (master plan §15).

POST /demo/seed  — idempotently create ~3 weeks of deterministic sessions
                   marked is_demo, in the client's local timezone.
DELETE /demo     — remove ONLY demo sessions; archive subjects the seeder
                   created (never the user's own subjects or sessions).
"""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from flask import Blueprint, g, jsonify

from ..extensions import db
from ..identity import require_client_identity
from ..models import Session, Subject, utcnow

bp = Blueprint("demo", __name__)
bp.before_request(require_client_identity)

DEMO_SUBJECTS = ("Work", "Reading", "Study", "Exercise")


def _build_pattern(local_today):
    """Deterministic 3-week rhythm, most recent day first.

    Weekday mornings belong to Work, Tue/Thu evenings to Reading,
    Saturdays to Study, Sundays to Exercise. Every 7th day back is a
    rest day so the terrain has honest gaps. Yesterday always has a
    session, so the reviewer's first completed demo session extends a
    live streak instead of starting from zero.
    """
    entries = []  # (local_date, hour, minute, subject_name, duration_minutes)
    for days_ago in range(1, 22):
        date = local_today - timedelta(days=days_ago)
        weekday = date.weekday()
        # Wednesdays rest — a fixed weekday gap gives the terrain honest
        # texture without ever wiping out a whole weekend subject.
        # Yesterday is always seeded so the reviewer's first completed
        # session extends a live streak.
        if weekday == 2 and days_ago != 1:
            continue
        if weekday < 5:
            entries.append((date, 9, 30, "Work", 25))
            if weekday in (0, 2, 4):
                entries.append((date, 10, 30, "Work", 50))
            if weekday in (1, 3):
                entries.append((date, 20, 15, "Reading", 25))
        elif weekday == 5:
            entries.append((date, 15, 0, "Study", 50))
            entries.append((date, 16, 10, "Study", 25))
        else:
            entries.append((date, 8, 0, "Exercise", 25))
            entries.append((date, 16, 30, "Reading", 25))
    return entries


@bp.post("/demo/seed")
def seed_demo():
    # Idempotent: a second call is a no-op report, never a duplicate atlas.
    # Only ACTIVE demo sessions count — a user who deleted them all should
    # be able to reseed (final audit MINOR).
    existing = Session.query.filter_by(
        client_id=g.client_id, is_demo=True, deleted_at=None
    ).count()
    if existing > 0:
        return jsonify({"seeded": False, "sessions": existing})

    tz = ZoneInfo(g.timezone)
    local_today = utcnow().replace(tzinfo=timezone.utc).astimezone(tz).date()

    subjects = {}
    for name in DEMO_SUBJECTS:
        subject = Subject.query.filter_by(
            client_id=g.client_id, normalized_name=name.casefold(), archived_at=None
        ).first()
        if subject is None:
            subject = Subject(
                client_id=g.client_id,
                name=name,
                normalized_name=name.casefold(),
                is_demo=True,  # created by the seeder -> removable
            )
            db.session.add(subject)
        subjects[name] = subject
    db.session.flush()

    count = 0
    for date, hour, minute, name, duration in _build_pattern(local_today):
        completed_local = datetime(
            date.year, date.month, date.day, hour, minute, tzinfo=tz
        )
        completed_utc = completed_local.astimezone(timezone.utc).replace(tzinfo=None)
        subject = subjects[name]
        db.session.add(
            Session(
                client_id=g.client_id,
                subject_id=subject.id,
                subject_name_snapshot=subject.name,
                duration=duration,
                started_at=completed_utc - timedelta(minutes=duration),
                completed_at=completed_utc,
                is_demo=True,
            )
        )
        count += 1
    db.session.commit()
    return jsonify({"seeded": True, "sessions": count})


@bp.delete("/demo")
def remove_demo():
    removed = Session.query.filter_by(
        client_id=g.client_id, is_demo=True
    ).delete(synchronize_session=False)

    # Archive (not delete) seeder-created subjects: real sessions recorded
    # on them keep valid references and their snapshot names.
    demo_subjects = Subject.query.filter_by(
        client_id=g.client_id, is_demo=True, archived_at=None
    ).all()
    for subject in demo_subjects:
        subject.archived_at = utcnow()

    db.session.commit()
    return jsonify({"success": True, "removed_sessions": removed})
