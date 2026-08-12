import hashlib
import json
from datetime import timedelta

from flask import Blueprint, g, jsonify, request
from sqlalchemy.exc import IntegrityError

from ..errors import ApiError
from ..extensions import db
from ..identity import require_client_identity
from ..models import Session, Subject, utcnow
from ..time_utils import parse_utc_timestamp, utc_bounds_for_range

bp = Blueprint("sessions", __name__)
bp.before_request(require_client_identity)

MIN_DURATION = 1
MAX_DURATION = 180
MAX_NOTE_LENGTH = 280
MAX_IDEMPOTENCY_KEY_LENGTH = 64
QUALITIES = ("flow", "okay", "distracted")
FUTURE_SKEW = timedelta(minutes=5)
ARCHIVE_SKEW = timedelta(minutes=5)


def _strict_int(value):
    """int only — bool is an int in Python and must be rejected."""
    return isinstance(value, int) and not isinstance(value, bool)


def _fingerprint(fields):
    """Deterministic digest of the client-provided request content."""
    canonical = json.dumps(fields, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _replay_response(existing, fingerprint):
    """Same key: identical request replays the original row (even a
    soft-deleted one — never resurrect); different request is a conflict."""
    if existing.request_fingerprint != fingerprint:
        raise ApiError(
            409,
            "idempotency_conflict",
            "Idempotency-Key was already used with a different request.",
        )
    return jsonify(existing.to_dict()), 200


@bp.post("/sessions")
def create_session():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise ApiError(400, "invalid_body", "A JSON object is required.")

    subject_id = payload.get("subject_id")
    if not _strict_int(subject_id):
        raise ApiError(400, "invalid_subject_id", "subject_id must be an integer.")

    duration = payload.get("duration")
    if not _strict_int(duration) or not MIN_DURATION <= duration <= MAX_DURATION:
        raise ApiError(
            400,
            "invalid_duration",
            "duration must be an integer between {} and {} minutes.".format(
                MIN_DURATION, MAX_DURATION
            ),
        )

    idempotency_key = (request.headers.get("Idempotency-Key") or "").strip() or None
    if idempotency_key and len(idempotency_key) > MAX_IDEMPOTENCY_KEY_LENGTH:
        raise ApiError(400, "invalid_idempotency_key", "Idempotency-Key is too long.")

    now = utcnow()

    completed_at = None
    if payload.get("completed_at") is not None:
        completed_at = parse_utc_timestamp(payload["completed_at"])
        if completed_at is None:
            raise ApiError(
                400, "invalid_completed_at", "completed_at must be ISO 8601."
            )
        if completed_at > now + FUTURE_SKEW:
            raise ApiError(
                400, "invalid_completed_at", "completed_at cannot be in the future."
            )

    started_at = None
    if payload.get("started_at") is not None:
        started_at = parse_utc_timestamp(payload["started_at"])
        if started_at is None:
            raise ApiError(400, "invalid_started_at", "started_at must be ISO 8601.")
        if (completed_at or now) < started_at:
            raise ApiError(
                400,
                "invalid_started_at",
                "completed_at cannot be earlier than started_at.",
            )

    pause_count = payload.get("pause_count", 0)
    paused_seconds = payload.get("paused_seconds", 0)
    if not _strict_int(pause_count) or pause_count < 0:
        raise ApiError(400, "invalid_pause_count", "pause_count must be >= 0.")
    if not _strict_int(paused_seconds) or paused_seconds < 0:
        raise ApiError(400, "invalid_paused_seconds", "paused_seconds must be >= 0.")

    quality = payload.get("quality")
    if quality is not None and quality not in QUALITIES:
        raise ApiError(
            400,
            "invalid_quality",
            "quality must be one of: {}.".format(", ".join(QUALITIES)),
        )

    note = payload.get("note")
    if note is not None:
        if not isinstance(note, str):
            raise ApiError(400, "invalid_note", "note must be a string.")
        note = note.strip()[:MAX_NOTE_LENGTH] or None

    # Fingerprint covers exactly what the client sent, normalized —
    # deterministic across retries of the same request (D28).
    fingerprint = _fingerprint(
        {
            "subject_id": subject_id,
            "duration": duration,
            "completed_at": completed_at.isoformat() if completed_at else "",
            "started_at": started_at.isoformat() if started_at else "",
            "pause_count": pause_count,
            "paused_seconds": paused_seconds,
            "quality": quality or "",
            "note": note or "",
        }
    )

    if idempotency_key:
        existing = Session.query.filter_by(
            client_id=g.client_id, idempotency_key=idempotency_key
        ).first()
        if existing is not None:
            return _replay_response(existing, fingerprint)

    # Ownership check. Archived subjects are accepted only for sessions
    # that actually started before the archive (D27) — an in-flight timer
    # must not lose its save, but archived subjects are not writable forever.
    subject = Subject.query.filter_by(id=subject_id, client_id=g.client_id).first()
    if subject is None:
        raise ApiError(404, "subject_not_found", "Subject not found.")
    if subject.archived_at is not None:
        if started_at is None or started_at > subject.archived_at + ARCHIVE_SKEW:
            raise ApiError(
                409,
                "subject_archived",
                "Subject was archived before this session started.",
            )

    session = Session(
        client_id=g.client_id,
        subject_id=subject.id,
        subject_name_snapshot=subject.name,
        duration=duration,
        started_at=started_at,
        completed_at=completed_at or now,
        pause_count=pause_count,
        paused_seconds=paused_seconds,
        quality=quality,
        note=note,
        idempotency_key=idempotency_key,
        request_fingerprint=fingerprint,
    )
    db.session.add(session)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        # Only a keyed request can be a concurrent replay; anything else
        # (constraint violations on keyless requests) must surface.
        if idempotency_key is None:
            raise
        existing = Session.query.filter_by(
            client_id=g.client_id, idempotency_key=idempotency_key
        ).first()
        if existing is None:
            raise
        return _replay_response(existing, fingerprint)
    return jsonify(session.to_dict()), 201


@bp.get("/sessions")
def list_sessions():
    query = Session.query.filter_by(client_id=g.client_id, deleted_at=None)

    subject_id_raw = request.args.get("subject_id")
    if subject_id_raw is not None:
        try:
            subject_id = int(subject_id_raw)
        except ValueError:
            raise ApiError(400, "invalid_subject_id", "subject_id must be an integer.")
        query = query.filter_by(subject_id=subject_id)

    range_name = request.args.get("range", "all")
    if range_name not in ("week", "month", "all"):
        raise ApiError(400, "invalid_range", "range must be week, month, or all.")
    bounds = utc_bounds_for_range(range_name, g.timezone, utcnow())
    if bounds is not None:
        query = query.filter(
            Session.completed_at >= bounds[0], Session.completed_at < bounds[1]
        )

    sessions = query.order_by(
        Session.completed_at.desc(), Session.id.desc()
    ).all()
    return jsonify([s.to_dict() for s in sessions])


@bp.delete("/sessions/<int:session_id>")
def delete_session(session_id):
    session = Session.query.filter_by(
        id=session_id, client_id=g.client_id, deleted_at=None
    ).first()
    if session is None:
        raise ApiError(404, "session_not_found", "Session not found.")
    # Soft delete keeps the idempotency evidence alive (D29): a late retry
    # of this session's POST replays instead of resurrecting it.
    session.deleted_at = utcnow()
    db.session.commit()
    return jsonify({"success": True})
