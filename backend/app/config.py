import os

from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(BASE_DIR, ".env"))


def _database_url():
    url = os.getenv("DATABASE_URL") or f"sqlite:///{os.path.join(BASE_DIR, 'eventure.db')}"
    if url.startswith("postgres://"):  # some hosts still hand out the old scheme
        url = "postgresql://" + url[len("postgres://"):]
    return url


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_DATABASE_URI = _database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "72"))
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    MAX_CONTENT_LENGTH = int(os.getenv("UPLOAD_MAX_MB", "8")) * 1024 * 1024

    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")
    GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

    ENABLE_SCHEDULER = os.getenv("ENABLE_SCHEDULER", "1") == "1"
    REMINDER_INTERVAL_MINUTES = int(os.getenv("REMINDER_INTERVAL_MINUTES", "15"))

    GEOCODE_OSM = os.getenv("GEOCODE_OSM", "1") == "1"  # free venue lookup when no Google Maps key is set
    FRONTEND_DIST = os.getenv("FRONTEND_DIST") or os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "dist"))
    AUTO_CREATE_DB = os.getenv("AUTO_CREATE_DB", "1") == "1"  # set 0 when you use Flask-Migrate
    TIMEZONE = os.getenv("TIMEZONE", "Asia/Kolkata")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

    # Google Calendar sync (OAuth)
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:5000/api/google/callback")

    # Browser and phone push alerts (Web Push / VAPID). Generate with scripts/generate_vapid_keys.py
    VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
    VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
    VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:eventure@example.com")

    # Email forwarding: forward to inbox+<your-token>@domain. Either poll a mailbox over IMAP or use a webhook.
    INBOX_ADDRESS = os.getenv("INBOX_ADDRESS", "")
    IMAP_HOST = os.getenv("IMAP_HOST", "")
    IMAP_PORT = int(os.getenv("IMAP_PORT", "993"))
    IMAP_USER = os.getenv("IMAP_USER", "")
    IMAP_PASSWORD = os.getenv("IMAP_PASSWORD", "")
    IMAP_POLL_MINUTES = int(os.getenv("IMAP_POLL_MINUTES", "5"))
    INBOUND_SECRET = os.getenv("INBOUND_SECRET", "")

    SMTP_HOST = os.getenv("SMTP_HOST", "")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM = os.getenv("SMTP_FROM", "eventure@example.com")
