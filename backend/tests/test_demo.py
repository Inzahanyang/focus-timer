from tests.conftest import headers


def seed(client, cid):
    return client.post("/demo/seed", headers=headers(cid))


def test_seed_creates_past_demo_sessions(client, cid):
    response = seed(client, cid)
    assert response.status_code == 200
    body = response.get_json()
    assert body["seeded"] is True
    assert body["sessions"] > 20

    sessions = client.get("/sessions", headers=headers(cid)).get_json()
    assert len(sessions) == body["sessions"]
    subjects = client.get("/subjects", headers=headers(cid)).get_json()
    assert {s["name"] for s in subjects} == {"Work", "Reading", "Study", "Exercise"}

    stats = client.get("/stats", headers=headers(cid)).get_json()
    assert stats["streak"] >= 2  # yesterday always seeded
    assert stats["total_hours"] > 0


def test_seed_is_idempotent(client, cid):
    first = seed(client, cid).get_json()
    second = seed(client, cid).get_json()
    assert second["seeded"] is False
    sessions = client.get("/sessions", headers=headers(cid)).get_json()
    assert len(sessions) == first["sessions"]


def test_seed_reuses_existing_subject_without_marking_it_demo(
    client, cid, make_subject
):
    mine = make_subject(cid, "Reading")  # user-created before seeding
    seed(client, cid)
    client.delete("/demo", headers=headers(cid))
    names = {s["name"] for s in client.get("/subjects", headers=headers(cid)).get_json()}
    # the user's own Reading survives; seeder-created subjects are archived
    assert "Reading" in names
    assert "Work" not in names
    assert mine["id"] in {
        s["id"] for s in client.get("/subjects", headers=headers(cid)).get_json()
    }


def test_remove_demo_keeps_real_sessions(client, cid):
    seed(client, cid)
    subjects = client.get("/subjects", headers=headers(cid)).get_json()
    work_id = next(s["id"] for s in subjects if s["name"] == "Work")
    # a real session recorded during demo mode is NOT demo data
    real = client.post(
        "/sessions",
        json={"subject_id": work_id, "duration": 25},
        headers=headers(cid),
    )
    assert real.status_code == 201

    response = client.delete("/demo", headers=headers(cid))
    assert response.status_code == 200
    assert response.get_json()["success"] is True

    remaining = client.get("/sessions", headers=headers(cid)).get_json()
    assert len(remaining) == 1
    assert remaining[0]["id"] == real.get_json()["id"]
    # snapshot keeps the archived subject readable in history
    assert remaining[0]["subject_name"] == "Work"


def test_demo_is_client_isolated(client, cid, cid2):
    seed(client, cid)
    assert client.get("/sessions", headers=headers(cid2)).get_json() == []
