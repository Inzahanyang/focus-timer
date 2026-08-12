import uuid

import pytest

from app import create_app
from app.extensions import db as _db


@pytest.fixture()
def app(tmp_path):
    class TestConfig:
        SQLALCHEMY_DATABASE_URI = "sqlite:///{}".format(tmp_path / "test.db")
        SQLALCHEMY_TRACK_MODIFICATIONS = False
        ALLOWED_ORIGINS = ["http://localhost:5173"]
        TESTING = True

    application = create_app(TestConfig)
    yield application
    with application.app_context():
        _db.session.remove()
        _db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def cid():
    return str(uuid.uuid4())


@pytest.fixture()
def cid2():
    return str(uuid.uuid4())


def headers(cid, tz="Asia/Seoul", **extra):
    base = {"X-Client-ID": cid, "X-Timezone": tz}
    base.update(extra)
    return base


@pytest.fixture()
def make_subject(client):
    def _make(cid, name="Reading"):
        response = client.post("/subjects", json={"name": name}, headers=headers(cid))
        assert response.status_code == 201, response.get_json()
        return response.get_json()

    return _make
