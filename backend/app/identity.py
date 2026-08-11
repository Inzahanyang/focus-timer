import uuid
from zoneinfo import ZoneInfo

from flask import g, request

from .errors import ApiError

CLIENT_ID_HEADER = "X-Client-ID"
TIMEZONE_HEADER = "X-Timezone"
DEFAULT_TIMEZONE = "UTC"


def require_client_identity():
    """Blueprint before_request hook.

    Validates X-Client-ID (must be a UUID) and resolves X-Timezone
    (falls back to UTC on anything invalid — stats may shift but the
    app must not break; see DECISIONS D6).
    """
    # CORS preflight carries no custom headers — never block it (D15).
    if request.method == "OPTIONS":
        return None

    raw = request.headers.get(CLIENT_ID_HEADER, "").strip()
    if not raw:
        raise ApiError(400, "missing_client_id", "X-Client-ID header is required.")
    try:
        uuid.UUID(raw)
    except (ValueError, AttributeError):
        raise ApiError(400, "invalid_client_id", "X-Client-ID must be a valid UUID.")
    g.client_id = raw.lower()

    tz_name = request.headers.get(TIMEZONE_HEADER, "").strip() or DEFAULT_TIMEZONE
    try:
        ZoneInfo(tz_name)
    except Exception:
        tz_name = DEFAULT_TIMEZONE
    g.timezone = tz_name
    return None
