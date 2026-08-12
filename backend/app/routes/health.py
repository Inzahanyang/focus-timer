from flask import Blueprint, jsonify
from sqlalchemy import text

from ..extensions import db

bp = Blueprint("health", __name__)


@bp.get("/health")
def health():
    try:
        db.session.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"
    status = "ok" if db_status == "ok" else "degraded"
    # 503 on DB failure so Railway's health check marks the deploy unhealthy.
    return jsonify({"status": status, "db": db_status}), (
        200 if db_status == "ok" else 503
    )
