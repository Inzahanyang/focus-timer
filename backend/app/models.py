from datetime import datetime, timezone

from .extensions import db


def utcnow():
    """Naive UTC now — all DB timestamps are stored as naive UTC."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso_utc(dt):
    """Serialize a naive-UTC datetime as ISO 8601 with explicit Z suffix.

    The assignment example omits the suffix, but suffix-less ISO strings are
    parsed as *local* time by JS `new Date()`, which corrupts displayed times.
    Adding Z keeps the field ISO 8601 and the contract intact (see DECISIONS D7).
    """
    if dt is None:
        return None
    return dt.replace(microsecond=0).isoformat() + "Z"


class Subject(db.Model):
    __tablename__ = "subjects"

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.String(36), nullable=False, index=True)
    name = db.Column(db.String(40), nullable=False)
    normalized_name = db.Column(db.String(40), nullable=False)
    color = db.Column(db.String(16), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    archived_at = db.Column(db.DateTime, nullable=True)

    sessions = db.relationship("Session", backref="subject", lazy=True)

    def to_dict(self):
        # Assignment contract: {id, name}. Extensions may add fields, never remove.
        return {"id": self.id, "name": self.name}


class Session(db.Model):
    __tablename__ = "sessions"
    __table_args__ = (
        db.UniqueConstraint(
            "client_id", "idempotency_key", name="uq_sessions_client_idempotency"
        ),
        db.Index("ix_sessions_client_completed", "client_id", "completed_at"),
        db.Index(
            "ix_sessions_client_subject_completed",
            "client_id",
            "subject_id",
            "completed_at",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.String(36), nullable=False, index=True)
    subject_id = db.Column(
        db.Integer, db.ForeignKey("subjects.id"), nullable=False
    )
    # Preserved so history stays correct after subject archive/rename.
    subject_name_snapshot = db.Column(db.String(40), nullable=False)
    duration = db.Column(db.Integer, nullable=False)  # minutes
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    pause_count = db.Column(db.Integer, nullable=False, default=0)
    paused_seconds = db.Column(db.Integer, nullable=False, default=0)
    quality = db.Column(db.String(16), nullable=True)  # flow | okay | distracted
    note = db.Column(db.String(280), nullable=True)
    idempotency_key = db.Column(db.String(64), nullable=True)
    is_demo = db.Column(db.Boolean, nullable=False, default=False)

    def to_dict(self):
        # Assignment contract fields; created_at maps to completion time (D7).
        return {
            "id": self.id,
            "subject_id": self.subject_id,
            "subject_name": self.subject_name_snapshot,
            "duration": self.duration,
            "created_at": iso_utc(self.completed_at),
        }
