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

    # Production must never silently run with the development signing key or a local SQLite
    # database. Supabase Postgres is supplied through DATABASE_URL at the hosting provider.
    if app.config.get("APP_ENV") == "production":
        secret = app.config.get("SECRET_KEY") or ""
        if len(secret) < 32:
            raise RuntimeError("Production requires a random SECRET_KEY of at least 32 characters.")
        if str(app.config.get("SQLALCHEMY_DATABASE_URI", "")).startswith("sqlite:"):
            raise RuntimeError("Production requires DATABASE_URL pointing to the managed Postgres database.")
    if os.getenv("TRUST_PROXY") == "1":  # behind nginx, Render, Railway, etc.
        from werkzeug.middleware.proxy_fix import ProxyFix

        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    if app.config["SECRET_KEY"] == "dev-secret-change-me" and not app.config.get("TESTING"):
        logging.warning("Using the default SECRET_KEY. Set SECRET_KEY in backend/.env before deploying.")

    origins = [o.strip() for o in app.config["CORS_ORIGINS"].split(",") if o.strip()]
    if app.config.get("APP_ENV") == "production" and "*" in origins:
        raise RuntimeError("Production CORS_ORIGINS must list trusted origins, not '*'.")
    CORS(app, resources={r"/api/*": {"origins": origins}})
    db.init_app(app)

    from .routes.assistant import bp as assistant_bp
    from .routes.auth import bp as auth_bp
    from .routes.discover import bp as discover_bp
    from .routes.google import bp as google_bp
    from .routes.google_login import bp as google_login_bp
    from .routes.inbox import bp as inbox_bp
    from .routes.integrations import bp as integrations_bp
    from .routes.organizer import bp as organizer_bp
    from .routes.push import bp as push_bp
    from .routes.social import bp as social_bp
    from .routes.timeline import bp as timeline_bp

    for bp in (auth_bp, google_login_bp, timeline_bp, discover_bp, social_bp, inbox_bp, google_bp, push_bp, organizer_bp, integrations_bp, assistant_bp):
        app.register_blueprint(bp)

    # Startup environment check & graceful notice logging (Part 9)
    if not app.config.get("SARVAM_API_KEY") or app.config.get("SARVAM_API_KEY") == "your_sarvam_api_key_here":
        logging.info("[Notice] SARVAM_API_KEY is not set in backend/.env — Smart Extraction will use deterministic offline fallback.")
    else:
        logging.info("[OK] Sarvam AI Indic Intelligence configured.")

    if not (app.config.get("GOOGLE_CLIENT_ID") and app.config.get("GOOGLE_CLIENT_SECRET")):
        logging.info("[Notice] Google sign-in is not configured — the 'Continue with Google' button stays hidden.")

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

    @app.after_request
    def set_security_headers(response):
        """ArgosX Security Gate: strict security headers & anti-fingerprinting."""
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(self), geolocation=(self)"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
        response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        if not app.config.get("TESTING"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'self' 'unsafe-inline' data: blob: https:; "
                "img-src 'self' data: blob: https:; "
                "connect-src 'self' https: http://localhost:* ws:; "
                "font-src 'self' https: data:;"
            )
        response.headers.pop("Server", None)
        return response

    _serve_frontend(app)

    @app.get("/api/health")
    def health():
        from sqlalchemy import text

        try:
            db.session.execute(text("SELECT 1"))
        except Exception:
            app.logger.exception("Database health check failed.")
            db.session.rollback()
            return jsonify(status="unavailable", database=False), 503
        google = bool(app.config.get("GOOGLE_CLIENT_ID") and app.config.get("GOOGLE_CLIENT_SECRET"))
        sarvam = bool(app.config.get("SARVAM_API_KEY") and "your_" not in app.config.get("SARVAM_API_KEY", ""))
        gemini = bool(app.config.get("GEMINI_API_KEY") and "your_" not in app.config.get("GEMINI_API_KEY", ""))
        return jsonify(status="ok", database=True, googleAuth=google, sarvamAuth=sarvam, geminiAuth=gemini)

    with app.app_context():
        from . import models  # noqa: F401  (registers tables)
        if app.config["AUTO_CREATE_DB"]:
            db.create_all()
            _sync_columns()
            _enable_postgres_rls()

    # Warm the public Discover catalogue on production startup. Network/source failures
    # are non-fatal and the request path can retry later using its refresh cache.
    if app.config.get("APP_ENV") == "production":
        try:
            from .services.discover_feed import sync_public_listings
            with app.app_context():
                imported = sync_public_listings()
            logging.info("[Discovery] Public feed sync completed; %d listings processed.", imported)
        except Exception:
            logging.exception("[Discovery] Initial public feed sync failed; API will remain available.")

    _start_scheduler(app)
    return app


def _sync_columns():
    """create_all() never alters existing tables, so columns added in later versions would be
    missing on old databases. Add any missing nullable column with a plain ALTER TABLE."""
    from sqlalchemy import inspect, text

    from .extensions import db

    inspector = inspect(db.engine)
    dialect = db.engine.dialect
    for table in db.metadata.sorted_tables:
        if table.name not in inspector.get_table_names():
            continue
        existing = {c["name"] for c in inspector.get_columns(table.name)}
        for col in table.columns:
            if col.name in existing:
                continue
            if not col.nullable and col.default is None:
                continue  # cannot backfill a required column on existing rows
            coltype = col.type.compile(dialect=dialect)
            db.session.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {coltype}'))
    db.session.commit()


def _enable_postgres_rls():
    """Keep Eventure's Postgres schema secured and indexed idempotently.

    Eventure's Flask API uses the dedicated eventure_app database role and
    performs application-level per-user authorization. Supabase browser roles
    (anon/authenticated) receive no table grants, and an explicit restrictive
    RLS policy denies them even if grants are changed later. The table-owner
    role used by Flask is not restricted by these browser-role policies.
    SQLite development databases are left unchanged.
    """
    from sqlalchemy import inspect, text

    from .extensions import db

    if db.engine.dialect.name != "postgresql":
        return

    inspector = inspect(db.engine)
    existing = set(inspector.get_table_names(schema="public"))
    quote = db.engine.dialect.identifier_preparer.quote

    # Add coverage for foreign keys used by frequent owner, team, club and timeline joins.
    query_indexes = (
        ("ix_club_follows_club_id", "club_follows", "club_id"),
        ("ix_clubs_created_by", "clubs", "created_by"),
        ("ix_events_club_id", "events", "club_id"),
        ("ix_events_created_by", "events", "created_by"),
        ("ix_team_members_user_id", "team_members", "user_id"),
        ("ix_teams_owner_id", "teams", "owner_id"),
        ("ix_top_priority_calls_user_event_id", "top_priority_calls", "user_event_id"),
        ("ix_user_events_team_id", "user_events", "team_id"),
    )

    for table in db.metadata.sorted_tables:
        if table.name not in existing:
            continue
        table_name = quote(table.name)
        db.session.execute(text(f"ALTER TABLE public.{table_name} ENABLE ROW LEVEL SECURITY"))

        # Restrictive policy is defense in depth: the Data API roles cannot see
        # or mutate rows even if table grants are changed later.
        policy_exists = db.session.execute(
            text(
                "SELECT 1 FROM pg_policies "
                "WHERE schemaname = 'public' AND tablename = :table_name "
                "AND policyname = 'eventure_block_supabase_browser_roles'"
            ),
            {"table_name": table.name},
        ).first()
        if not policy_exists:
            db.session.execute(
                text(
                    f"CREATE POLICY eventure_block_supabase_browser_roles "
                    f"ON public.{table_name} AS RESTRICTIVE FOR ALL "
                    "TO anon, authenticated USING (false) WITH CHECK (false)"
                )
            )

    for index_name, table_name, column_name in query_indexes:
        if table_name in existing:
            db.session.execute(
                text(
                    f"CREATE INDEX IF NOT EXISTS {quote(index_name)} "
                    f"ON public.{quote(table_name)} ({quote(column_name)})"
                )
            )
    db.session.commit()


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
