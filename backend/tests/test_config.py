"""Database URL resolution — the deployment foot-gun checks."""

from app.config import _database_url


def test_default_is_local_sqlite(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    url = _database_url()
    assert url.startswith("sqlite:///")
    assert url.endswith("focus.db")


def test_heroku_style_postgres_scheme_is_rewritten(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgres://u:p@host:5432/db")
    assert _database_url() == "postgresql+psycopg://u:p@host:5432/db"


def test_plain_postgresql_scheme_gets_psycopg3_driver(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@host:5432/db")
    assert _database_url() == "postgresql+psycopg://u:p@host:5432/db"


def test_explicit_driver_is_left_alone(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@host/db")
    assert _database_url() == "postgresql+psycopg://u:p@host/db"
