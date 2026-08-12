from flask import Flask
from flask_cors import CORS

from .config import Config
from .errors import register_error_handlers
from .extensions import db


def create_app(config_object=Config):
    app = Flask(__name__)
    app.config.from_object(config_object)

    db.init_app(app)

    CORS(
        app,
        origins=app.config["ALLOWED_ORIGINS"],
        allow_headers=[
            "Content-Type",
            "X-Client-ID",
            "X-Timezone",
            "Idempotency-Key",
        ],
        methods=["GET", "POST", "DELETE", "PATCH", "OPTIONS"],
    )

    from .routes.health import bp as health_bp
    from .routes.sessions import bp as sessions_bp
    from .routes.subjects import bp as subjects_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(subjects_bp)
    app.register_blueprint(sessions_bp)

    register_error_handlers(app)

    with app.app_context():
        db.create_all()

    return app
