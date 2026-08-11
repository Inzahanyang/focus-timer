from flask import Blueprint, g, jsonify, request

from ..errors import ApiError
from ..extensions import db
from ..identity import require_client_identity
from ..models import Subject, utcnow

bp = Blueprint("subjects", __name__)
bp.before_request(require_client_identity)

MAX_NAME_LENGTH = 40


@bp.get("/subjects")
def list_subjects():
    subjects = (
        Subject.query.filter_by(client_id=g.client_id, archived_at=None)
        .order_by(Subject.created_at.asc())
        .all()
    )
    return jsonify([subject.to_dict() for subject in subjects])


@bp.post("/subjects")
def create_subject():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()

    if not name:
        raise ApiError(400, "invalid_name", "Subject name is required.")
    if len(name) > MAX_NAME_LENGTH:
        raise ApiError(
            400,
            "invalid_name",
            "Subject name must be at most {} characters.".format(MAX_NAME_LENGTH),
        )

    normalized = name.casefold()
    duplicate = Subject.query.filter_by(
        client_id=g.client_id, normalized_name=normalized, archived_at=None
    ).first()
    if duplicate is not None:
        raise ApiError(
            409, "duplicate_subject", "A subject with this name already exists."
        )

    subject = Subject(
        client_id=g.client_id, name=name, normalized_name=normalized
    )
    db.session.add(subject)
    db.session.commit()
    return jsonify(subject.to_dict()), 201


@bp.delete("/subjects/<int:subject_id>")
def delete_subject(subject_id):
    subject = Subject.query.filter_by(
        id=subject_id, client_id=g.client_id, archived_at=None
    ).first()
    if subject is None:
        # Not owned or nonexistent — indistinguishable on purpose.
        raise ApiError(404, "subject_not_found", "Subject not found.")

    # Soft delete keeps historical sessions valid (D8).
    subject.archived_at = utcnow()
    db.session.commit()
    return jsonify({"success": True})
