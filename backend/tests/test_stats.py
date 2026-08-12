import uuid
from datetime import datetime, timedelta, timezone

from zoneinfo import ZoneInfo

from tests.conftest import headers

SEOUL = ZoneInfo("Asia/Seoul")
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def iso_z(local_dt):
    return local_dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S") + "Z"


def local_now():
    return datetime.now(SEOUL)


def week_start_local():
    now = local_now()
    return (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )


def safe_inside_week():
    candidate = week_start_local() + timedelta(seconds=90)
    return min(candidate, local_now() - timedelta(seconds=1))


def post_session(client, cid, body, key=None):
    extra = {"Idempotency-Key": key} if key else {}
    response = client.post("/sessions", json=body, headers=headers(cid, **extra))
    assert response.status_code in (200, 201), response.get_json()
    return response.get_json()


def get_stats(client, cid):
    response = client.get("/stats", headers=headers(cid))
    assert response.status_code == 200
    return response.get_json()


def test_empty_stats_has_full_schema(client, cid):
    stats = get_stats(client, cid)
    assert stats["streak"] == 0
    assert stats["total_hours"] == 0.0
    assert stats["sessions_this_week"] == 0
    assert stats["by_subject"] == []
    assert list(stats["by_weekday"].keys()) == WEEKDAYS
    assert all(v == 0 for v in stats["by_weekday"].values())


def test_totals_week_count_and_weekday_bucket(client, cid, make_subject):
    subject = make_subject(cid)
    inside = safe_inside_week()
    outside = week_start_local() - timedelta(hours=2)

    post_session(client, cid, {
        "subject_id": subject["id"], "duration": 60, "completed_at": iso_z(inside),
    })
    post_session(client, cid, {
        "subject_id": subject["id"], "duration": 30, "completed_at": iso_z(outside),
    })

    stats = get_stats(client, cid)
    assert stats["total_hours"] == 1.5  # 90 minutes all-time
    assert stats["sessions_this_week"] == 1
    assert stats["by_weekday"][WEEKDAYS[inside.weekday()]] == 60
    assert sum(stats["by_weekday"].values()) == 60  # outside week not counted


def test_by_subject_descending_and_archived_name_kept(client, cid, make_subject):
    reading = make_subject(cid, "Reading")
    work = make_subject(cid, "Work")
    when = iso_z(local_now() - timedelta(hours=1))
    post_session(client, cid, {"subject_id": reading["id"], "duration": 30, "completed_at": when})
    post_session(client, cid, {"subject_id": work["id"], "duration": 90, "completed_at": when})

    client.delete("/subjects/{}".format(work["id"]), headers=headers(cid))

    stats = get_stats(client, cid)
    assert [(s["name"], s["minutes"]) for s in stats["by_subject"]] == [
        ("Work", 90),
        ("Reading", 30),
    ]
    assert stats["by_subject"][0]["subject_id"] == work["id"]  # additive field


def test_streak_counts_consecutive_local_days(client, cid, make_subject):
    subject = make_subject(cid)
    noon = local_now().replace(hour=12, minute=0, second=0, microsecond=0)
    # guard: if it's before noon, use an hour that already passed today
    if noon > local_now():
        noon = local_now() - timedelta(minutes=5)
    for days_ago in (0, 1, 2):
        post_session(client, cid, {
            "subject_id": subject["id"],
            "duration": 25,
            "completed_at": iso_z(noon - timedelta(days=days_ago)),
        }, key=str(uuid.uuid4()))
    # a second session today must not double-count the day
    post_session(client, cid, {
        "subject_id": subject["id"], "duration": 25,
        "completed_at": iso_z(noon - timedelta(hours=1)),
    }, key=str(uuid.uuid4()))

    assert get_stats(client, cid)["streak"] == 3


def test_streak_anchors_on_yesterday_when_today_is_empty(client, cid, make_subject):
    subject = make_subject(cid)
    yesterday = local_now() - timedelta(days=1)
    two_days = local_now() - timedelta(days=2)
    for when in (yesterday, two_days):
        post_session(client, cid, {
            "subject_id": subject["id"], "duration": 25, "completed_at": iso_z(when),
        }, key=str(uuid.uuid4()))
    assert get_stats(client, cid)["streak"] == 2


def test_streak_breaks_on_gap(client, cid, make_subject):
    subject = make_subject(cid)
    post_session(client, cid, {
        "subject_id": subject["id"], "duration": 25,
        "completed_at": iso_z(local_now() - timedelta(days=3)),
    })
    assert get_stats(client, cid)["streak"] == 0


def test_idempotent_replay_and_delete_affect_stats_correctly(client, cid, make_subject):
    subject = make_subject(cid)
    key = str(uuid.uuid4())
    body = {
        "subject_id": subject["id"], "duration": 25,
        "completed_at": iso_z(local_now() - timedelta(minutes=30)),
    }
    created = post_session(client, cid, body, key)
    post_session(client, cid, body, key)  # replay
    assert get_stats(client, cid)["total_hours"] == 0.4  # 25/60 once, not twice

    client.delete("/sessions/{}".format(created["id"]), headers=headers(cid))
    stats = get_stats(client, cid)
    assert stats["total_hours"] == 0.0
    assert stats["sessions_this_week"] == 0


def test_stats_are_client_isolated(client, cid, cid2, make_subject):
    subject = make_subject(cid)
    post_session(client, cid, {"subject_id": subject["id"], "duration": 25})
    assert get_stats(client, cid2)["total_hours"] == 0.0
