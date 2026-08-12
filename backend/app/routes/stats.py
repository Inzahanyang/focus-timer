from flask import Blueprint, g, jsonify

from ..identity import require_client_identity
from ..models import utcnow
from ..stats_service import compute_stats

bp = Blueprint("stats", __name__)
bp.before_request(require_client_identity)


@bp.get("/stats")
def get_stats():
    return jsonify(compute_stats(g.client_id, g.timezone, utcnow()))
