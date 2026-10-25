import logging
import os

from flask import Flask, jsonify

from .utils import ApiError


def create_app(config_object=None):
    # Imports live inside the factory so the pure logic in app.services can be
    # imported and tested without Flask-SQLAlchemy installed.
    from flask_cors import CORS

    from .config import Config
    from .extensions import db

    app = Flask(__name__)
    app.config.from_object(config_object or Config)
    if os.getenv("TRUST_PROXY") == "1":  # behind nginx, Render, Railway, etc.
        from werkzeug.middleware.proxy_fix import ProxyFix

        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    if app.config["SECRET_KEY"] == "dev-secret-change-me" and not app.config.get("TESTING"):
        logging.warning("Using the default SECRET_KEY. Set SECRET_KEY in backend/.env before deploying.")

    origins = [o.strip() for o in app.config["CORS_ORIGINS"].split(",") if o.strip()]
    CORS(app, resources={r"/api/*": {"origins": origins}})
    db.init_app(app)

    from .routes.auth import bp as auth_bp
    from .routes.discover import bp as discover_bp
    from .routes.google import bp as google_bp
    from .routes.inbox import bp as inbox_bp
    from .routes.organizer import bp as organizer_bp
    from .routes.push import bp as push_bp
    from .routes.social import bp as social_bp
    from .routes.timeline import bp as timeline_bp

    for bp in (auth_bp, timeline_bp, discover_bp, social_bp, inbox_bp, google_bp, push_bp, organizer_bp):
        app.register_blueprint(bp)

    try:  # optional: schema migrations (flask --app run db init / migrate / upgrade)
        from flask_migrate import Migrate

        Migrate(app, db)
    except ImportError:
        pass

    @app.errorhandler(ApiError)
    def handle_api_error(err):
        return jsonify(error=err.message), err.status

    @app.errorhandler(404)
    def handle_404(_err):
        return jsonify(error="That page or item does not exist."), 404

    @app.errorhandler(413)
    def handle_413(_err):
        return jsonify(error="That file is too large. Upload an image under 8 MB."), 413

    @app.errorhandler(500)
    def handle_500(_err):
        return jsonify(error="Something went wrong on our side. Try again."), 500

    _serve_frontend(app)

    @app.get("/api/health")
    def health():
        return jsonify(status="ok")

    with app.app_context():
        from . import models  # noqa: F401  (registers tables)
        if app.config["AUTO_CREATE_DB"]:
            db.create_all()

    _start_scheduler(app)
    return app


def _serve_frontend(app):
    """One-URL deployment: if the React app has been built (npm run build), Flask serves it too."""
    dist = app.config.get("FRONTEND_DIST")
    if not dist or not os.path.isfile(os.path.join(dist, "index.html")):
        return
    from flask import abort, send_from_directory

    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def spa(path):
        if path.startswith("api/"):
            abort(404)
        if path and os.path.isfile(os.path.join(dist, path)):
            return send_from_directory(dist, path)
        return send_from_directory(dist, "index.html")


def _start_scheduler(app):
    if not app.config["ENABLE_SCHEDULER"] or app.config.get("TESTING"):
        return
    # With the Flask reloader the factory runs in two processes; only the child should schedule jobs.
    if os.environ.get("EVENTURE_DEBUG") and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        return
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
    except ImportError:
        logging.warning("APScheduler is not installed; deadline reminders will not run automatically.")
        return

    from .services.imap_poll import poll_inbox
    from .services.reminders import run_reminder_check

    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(
        lambda: run_reminder_check(app),
        "interval",
        minutes=app.config["REMINDER_INTERVAL_MINUTES"],
        id="deadline-reminders",
    )
    if app.config["IMAP_HOST"]:
        scheduler.add_job(
            lambda: poll_inbox(app),
            "interval",
            minutes=app.config["IMAP_POLL_MINUTES"],
            id="inbox-poll",
        )
    scheduler.start()
    app.extensions["scheduler"] = scheduler
