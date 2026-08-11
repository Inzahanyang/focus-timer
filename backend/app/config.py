import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/


def _database_url():
    url = os.environ.get("DATABASE_URL", "").strip()
    if url:
        # Railway/Heroku emit postgres://; SQLAlchemy needs postgresql://
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url
    instance_dir = BASE_DIR / "instance"
    instance_dir.mkdir(exist_ok=True)
    return "sqlite:///{}".format(instance_dir / "focus.db")


class Config:
    SQLALCHEMY_DATABASE_URI = _database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    ALLOWED_ORIGINS = [
        origin.strip()
        for origin in os.environ.get(
            "ALLOWED_ORIGINS", "http://localhost:5173"
        ).split(",")
        if origin.strip()
    ]
