import uuid
from datetime import datetime, timedelta, timezone

from zoneinfo import ZoneInfo

from tests.conftest import headers

SEOUL = ZoneInfo("Asia/Seoul")


def iso_z(local_dt):
    """Local aware datetime -> UTC ISO string with Z."""
    return local_dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S") + "Z"


def local_now():
    return datetime.now(SEOUL)


def week_start_local():
    now = local_now()
    return (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )


def month_start_local():
    return local_now().replace(hour=0, minute=0, second=0, microsecond=0, day=1)


def safe_inside(start_local):
    """A moment inside [start_local, now] that is never in the future."""
    candidate = start_local + timedelta(seconds=90)
    return min(candidate, local_now() - timedelta(seconds=1))


def post_session(client, cid, body, key=None):
    extra = {"Idempotency-Key": key} if key else {}
    return client.post("/sessions", json=body, headers=headers(cid, **extra))


def test_create_returns_contract_fields(client, cid, make_subject):
    subject = make_subject(cid)
    response = post_session(client, cid, {"subject_id": subject["id"], "duration": 25})
    assert response.status_code == 201
    data = response.get_json()
    assert data["subject_id"] == subject["id"]
    assert data["subject_name"] == "Reading"
    assert data["duration"] == 25
    assert data["created_at"].endswith("Z")


def test_snapshot_survives_subject_archive(client, cid, make_subject):
    subject = make_subject(cid)
    post_session(client, cid, {"subject_id": subject["id"], "duration": 25})
    client.delete("/subjects/{}".format(subject["id"]), headers=headers(cid))
    sessions = client.get("/sessions", headers=headers(cid)).get_json()
    assert sessions[0]["subject_name"] == "Reading"


def test_archived_subject_still_accepts_in_flight_session(client, cid, make_subject):
    subject = make_subject(cid)
    client.delete("/subjects/{}".format(subject["id"]), headers=headers(cid))
    response = post_session(client, cid, {"subject_id": subject["id"], "duration": 25})
    assert response.status_code == 201  # D27


def test_duration_validation(client, cid, make_subject):
    subject = make_subject(cid)
    for bad in (0, -5, 181, True, "25", 2.5, None):
        response = post_session(client, cid, {"subject_id": subject["id"], "duration": bad})
        assert response.status_code == 400, bad


def test_subject_ownership(client, cid, cid2, make_subject):
    subject = make_subject(cid)
    # nonexistent
    assert post_session(client, cid, {"subject_id": 999, "duration": 25}).status_code == 404
    # someone else's subject
    assert (
        post_session(client, cid2, {"subject_id": subject["id"], "duration": 25}).status_code
        == 404
    )


def test_completed_at_is_used_not_receive_time(client, cid, make_subject):
    subject = make_subject(cid)
    friday_ish = local_now() - timedelta(days=3)
    response = post_session(
        client,
        cid,
        {
            "subject_id": subject["id"],
            "duration": 25,
            "completed_at": iso_z(friday_ish),
        },
    )
    assert response.status_code == 201
    assert response.get_json()["created_at"] == iso_z(friday_ish)


def test_future_completed_at_rejected(client, cid, make_subject):
    subject = make_subject(cid)
    response = post_session(
        client,
        cid,
        {
            "subject_id": subject["id"],
            "duration": 25,
            "completed_at": iso_z(local_now() + timedelta(hours=2)),
        },
    )
    assert response.status_code == 400


def test_idempotent_replay_returns_same_session(client, cid, make_subject):
    subject = make_subject(cid)
    key = str(uuid.uuid4())
    first = post_session(client, cid, {"subject_id": subject["id"], "duration": 25}, key)
    second = post_session(client, cid, {"subject_id": subject["id"], "duration": 25}, key)
    assert first.status_code == 201
    assert second.status_code == 200
    assert first.get_json()["id"] == second.get_json()["id"]
    assert len(client.get("/sessions", headers=headers(cid)).get_json()) == 1


def test_same_key_different_clients_both_create(client, cid, cid2, make_subject):
    s1 = make_subject(cid)
    s2 = make_subject(cid2)
    key = str(uuid.uuid4())
    assert post_session(client, cid, {"subject_id": s1["id"], "duration": 25}, key).status_code == 201
    assert post_session(client, cid2, {"subject_id": s2["id"], "duration": 25}, key).status_code == 201


def test_list_newest_first_and_note_extension(client, cid, make_subject):
    subject = make_subject(cid)
    older = local_now() - timedelta(hours=3)
    newer = local_now() - timedelta(minutes=10)
    post_session(
        client,
        cid,
        {
            "subject_id": subject["id"],
            "duration": 25,
            "completed_at": iso_z(older),
            "note": "first",
        },
    )
    post_session(
        client,
        cid,
        {
            "subject_id": subject["id"],
            "duration": 50,
            "completed_at": iso_z(newer),
            "note": "second",
        },
    )
    sessions = client.get("/sessions", headers=headers(cid)).get_json()
    assert [s["note"] for s in sessions] == ["second", "first"]


def test_range_and_subject_filters_combine(client, cid, make_subject):
    reading = make_subject(cid, "Reading")
    work = make_subject(cid, "Work")

    inside_week = safe_inside(week_start_local())
    before_week = week_start_local() - timedelta(hours=1)
    before_month = month_start_local() - timedelta(hours=1)

    post_session(client, cid, {"subject_id": reading["id"], "duration": 25, "completed_at": iso_z(inside_week)})
    post_session(client, cid, {"subject_id": work["id"], "duration": 30, "completed_at": iso_z(inside_week)})
    post_session(client, cid, {"subject_id": reading["id"], "duration": 45, "completed_at": iso_z(before_week)})
    post_session(client, cid, {"subject_id": reading["id"], "duration": 60, "completed_at": iso_z(before_month)})

    def durations(query):
        response = client.get("/sessions" + query, headers=headers(cid))
        assert response.status_code == 200
        return sorted(s["duration"] for s in response.get_json())

    assert durations("") == [25, 30, 45, 60]
    assert durations("?range=week") == [25, 30]
    assert 60 not in durations("?range=month")
    assert durations("?subject_id={}".format(reading["id"])) == [25, 45, 60]
    assert durations(
        "?subject_id={}&range=week".format(reading["id"])
    ) == [25]


def test_invalid_filters_are_400(client, cid):
    assert client.get("/sessions?range=year", headers=headers(cid)).status_code == 400
    assert client.get("/sessions?subject_id=abc", headers=headers(cid)).status_code == 400


def test_client_isolation_and_delete(client, cid, cid2, make_subject):
    subject = make_subject(cid)
    created = post_session(client, cid, {"subject_id": subject["id"], "duration": 25}).get_json()

    # invisible to another client
    assert client.get("/sessions", headers=headers(cid2)).get_json() == []
    # cross-client delete is 404
    assert (
        client.delete("/sessions/{}".format(created["id"]), headers=headers(cid2)).status_code
        == 404
    )
    # owner delete works, re-delete 404
    response = client.delete("/sessions/{}".format(created["id"]), headers=headers(cid))
    assert response.status_code == 200
    assert response.get_json() == {"success": True}
    assert client.get("/sessions", headers=headers(cid)).get_json() == []
    assert (
        client.delete("/sessions/{}".format(created["id"]), headers=headers(cid)).status_code
        == 404
    )
