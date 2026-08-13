from tests.conftest import headers


def test_list_starts_empty(client, cid):
    response = client.get("/subjects", headers=headers(cid))
    assert response.status_code == 200
    assert response.get_json() == []


def test_missing_client_id_is_400(client):
    assert client.get("/subjects").status_code == 400


def test_invalid_client_id_is_400(client):
    response = client.get("/subjects", headers={"X-Client-ID": "not-a-uuid"})
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "invalid_client_id"


def test_noncanonical_uuid_maps_to_same_client(client, cid, make_subject):
    make_subject(cid, "Reading")
    hyphenless = cid.replace("-", "").upper()
    response = client.get("/subjects", headers=headers(hyphenless))
    assert [s["name"] for s in response.get_json()] == ["Reading"]


def test_create_trims_and_returns_contract_fields(client, cid):
    response = client.post(
        "/subjects", json={"name": "  Work  "}, headers=headers(cid)
    )
    assert response.status_code == 201
    assert response.get_json() == {"id": response.get_json()["id"], "name": "Work"}


def test_create_rejects_bad_bodies(client, cid):
    for body in (["x"], "plain", 5, None, {}, {"name": 123}, {"name": "  "}):
        response = client.post("/subjects", json=body, headers=headers(cid))
        assert response.status_code == 400, body
    response = client.post(
        "/subjects", json={"name": "x" * 41}, headers=headers(cid)
    )
    assert response.status_code == 400
    # casefold expansion and NUL bytes are 400, never a DB-level 500
    for name in ("ß" * 40, "a\x00b"):
        response = client.post("/subjects", json={"name": name}, headers=headers(cid))
        assert response.status_code == 400, repr(name)


def test_duplicate_name_is_409_case_insensitive(client, cid, make_subject):
    make_subject(cid, "Reading")
    response = client.post(
        "/subjects", json={"name": "reading"}, headers=headers(cid)
    )
    assert response.status_code == 409
    assert response.get_json()["error"]["code"] == "duplicate_subject"


def test_same_name_allowed_for_other_client(client, cid, cid2, make_subject):
    make_subject(cid, "Reading")
    response = client.post(
        "/subjects", json={"name": "Reading"}, headers=headers(cid2)
    )
    assert response.status_code == 201


def test_delete_archives_and_allows_name_reuse(client, cid, make_subject):
    subject = make_subject(cid, "Reading")
    response = client.delete(
        "/subjects/{}".format(subject["id"]), headers=headers(cid)
    )
    assert response.status_code == 200
    assert response.get_json() == {"success": True}
    assert client.get("/subjects", headers=headers(cid)).get_json() == []
    # re-delete is 404, name is reusable
    assert (
        client.delete("/subjects/{}".format(subject["id"]), headers=headers(cid)).status_code
        == 404
    )
    assert (
        client.post("/subjects", json={"name": "Reading"}, headers=headers(cid)).status_code
        == 201
    )


def test_cross_client_delete_is_404(client, cid, cid2, make_subject):
    subject = make_subject(cid, "Reading")
    response = client.delete(
        "/subjects/{}".format(subject["id"]), headers=headers(cid2)
    )
    assert response.status_code == 404
    # still visible to the owner
    assert len(client.get("/subjects", headers=headers(cid)).get_json()) == 1
