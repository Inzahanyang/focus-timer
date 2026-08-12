"""Time boundary helpers.

Policy (DECISIONS D6): storage is naive UTC; week/month boundaries are
computed in the client's IANA timezone as half-open local intervals
[start, end), then converted to UTC for DB comparison. Never subtract
fixed 7*24h in UTC — DST weeks are not 168 hours.

Shared by GET /sessions and (later) GET /stats so History and Dashboard
can never disagree about what "this week" means.
"""

from datetime import datetime, time as dt_time, timedelta, timezone
from zoneinfo import ZoneInfo


def utc_bounds_for_range(range_name, tz_name, now_utc):
    """Return (start_utc_naive, end_utc_naive) for 'week'|'month',
    or None for 'all'. Raises ValueError on unknown ranges."""
    if range_name == "all":
        return None

    tz = ZoneInfo(tz_name)
    local_now = now_utc.replace(tzinfo=timezone.utc).astimezone(tz)

    if range_name == "week":
        start_date = local_now.date() - timedelta(days=local_now.weekday())
        end_date = start_date + timedelta(days=7)
    elif range_name == "month":
        start_date = local_now.date().replace(day=1)
        end_date = (start_date + timedelta(days=32)).replace(day=1)
    else:
        raise ValueError("unknown range: {}".format(range_name))

    start_local = datetime.combine(start_date, dt_time.min, tzinfo=tz)
    end_local = datetime.combine(end_date, dt_time.min, tzinfo=tz)
    return (
        start_local.astimezone(timezone.utc).replace(tzinfo=None),
        end_local.astimezone(timezone.utc).replace(tzinfo=None),
    )


def parse_utc_timestamp(value):
    """Parse an ISO 8601 string into naive UTC. Accepts a Z suffix or an
    explicit offset; a bare timestamp is treated as UTC. Returns None on
    anything unparseable."""
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if raw.endswith(("Z", "z")):
        raw = raw[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).replace(tzinfo=None)
