import json
import secrets
from datetime import datetime

from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import db
from .utils import iso

STATUSES = ("interested", "registered", "attended", "skipped")


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(200), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(300), nullable=False)
    college = db.Column(db.String(200))
    college_lat = db.Column(db.Float)
    college_lng = db.Column(db.Float)
    goals = db.Column(db.String(500), default="")  # comma separated, e.g. "hackathon, ai, internships"
    inbox_token = db.Column(db.String(32), unique=True, nullable=False, default=lambda: secrets.token_hex(5))
    created_at = db.Column(db.DateTime, default=datetime.now)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def goals_list(self):
        return [g.strip() for g in (self.goals or "").split(",") if g.strip()]

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "college": self.college,
            "college_lat": self.college_lat,
            "college_lng": self.college_lng,
            "goals": self.goals_list,
        }


class Club(db.Model):
    __tablename__ = "clubs"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    college = db.Column(db.String(200))
    description = db.Column(db.Text, default="")
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    created_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "college": self.college, "description": self.description}


class ClubFollow(db.Model):
    __tablename__ = "club_follows"
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), primary_key=True)
    club_id = db.Column(db.Integer, db.ForeignKey("clubs.id"), primary_key=True)


class Event(db.Model):
    __tablename__ = "events"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(250), nullable=False)
    platform = db.Column(db.String(80))
    category = db.Column(db.String(60))
    description = db.Column(db.Text, default="")
    venue_name = db.Column(db.String(250))
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    start_at = db.Column(db.DateTime, index=True)
    end_at = db.Column(db.DateTime)
    registration_deadline = db.Column(db.DateTime)
    url = db.Column(db.String(500))
    club_id = db.Column(db.Integer, db.ForeignKey("clubs.id"))
    is_public = db.Column(db.Boolean, default=False, index=True)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    created_at = db.Column(db.DateTime, default=datetime.now)

    club = db.relationship("Club")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "platform": self.platform,
            "category": self.category,
            "description": self.description,
            "venue_name": self.venue_name,
            "lat": self.lat,
            "lng": self.lng,
            "start_at": iso(self.start_at),
            "end_at": iso(self.end_at),
            "registration_deadline": iso(self.registration_deadline),
            "url": self.url,
            "club_id": self.club_id,
            "club_name": self.club.name if self.club else None,
            "is_public": bool(self.is_public),
        }


class Team(db.Model):
    __tablename__ = "teams"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    code = db.Column(db.String(12), unique=True, nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)


class TeamMember(db.Model):
    __tablename__ = "team_members"
    team_id = db.Column(db.Integer, db.ForeignKey("teams.id"), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), primary_key=True)


class UserEvent(db.Model):
    """One student's journey through one event."""
    __tablename__ = "user_events"
    __table_args__ = (db.UniqueConstraint("user_id", "event_id", name="uq_user_event"),)
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    event_id = db.Column(db.Integer, db.ForeignKey("events.id"), nullable=False, index=True)
    status = db.Column(db.String(20), default="interested", nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("teams.id"))
    notes = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.now)

    event = db.relationship("Event")
    stages = db.relationship("Stage", cascade="all, delete-orphan", order_by="Stage.due_at")
    user = db.relationship("User")


class Stage(db.Model):
    __tablename__ = "stages"
    id = db.Column(db.Integer, primary_key=True)
    user_event_id = db.Column(db.Integer, db.ForeignKey("user_events.id"), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    due_at = db.Column(db.DateTime)
    done = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "due_at": iso(self.due_at), "done": bool(self.done)}


class ExamPeriod(db.Model):
    __tablename__ = "exam_periods"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    label = db.Column(db.String(120), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)

    def to_dict(self):
        return {"id": self.id, "label": self.label, "start_date": self.start_date.isoformat(), "end_date": self.end_date.isoformat()}


class Review(db.Model):
    __tablename__ = "reviews"
    __table_args__ = (db.UniqueConstraint("user_id", "event_id", name="uq_review_user_event"),)
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey("events.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    organisation = db.Column(db.Integer, nullable=False)
    learning = db.Column(db.Integer, nullable=False)
    value = db.Column(db.Integer, nullable=False)  # worth the time and travel
    overall = db.Column(db.Float, nullable=False)
    comment = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.now)

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "author": self.user.name if self.user else "Student",
            "college": self.user.college if self.user else None,
            "organisation": self.organisation,
            "learning": self.learning,
            "value": self.value,
            "overall": self.overall,
            "comment": self.comment,
            "created_at": iso(self.created_at),
            "verified": True,  # reviews can only be written by students who attended
        }


class Notification(db.Model):
    __tablename__ = "notifications"
    __table_args__ = (db.UniqueConstraint("user_id", "dedupe_key", name="uq_notification_key"),)
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    message = db.Column(db.String(500), nullable=False)
    level = db.Column(db.String(20), default="info")
    dedupe_key = db.Column(db.String(120))
    read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {"id": self.id, "message": self.message, "level": self.level, "read": bool(self.read), "created_at": iso(self.created_at)}


class InboxItem(db.Model):
    """An email the student forwarded to Eventure, waiting for them to confirm."""
    __tablename__ = "inbox_items"
    __table_args__ = (db.UniqueConstraint("user_id", "message_id", name="uq_inbox_message"),)
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    message_id = db.Column(db.String(300), nullable=False)
    sender = db.Column(db.String(300))
    subject = db.Column(db.String(500))
    body = db.Column(db.Text, default="")
    parsed = db.Column(db.Text, default="{}")  # JSON from the extractor
    status = db.Column(db.String(20), default="pending")  # pending, added, dismissed
    created_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        try:
            parsed = json.loads(self.parsed or "{}")
        except ValueError:
            parsed = {}
        return {"id": self.id, "sender": self.sender, "subject": self.subject, "parsed": parsed,
                "status": self.status, "created_at": iso(self.created_at)}


class GoogleAccount(db.Model):
    __tablename__ = "google_accounts"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    refresh_token = db.Column(db.Text, nullable=False)
    access_token = db.Column(db.Text)
    expires_at = db.Column(db.DateTime)
    last_sync = db.Column(db.DateTime)


class SyncedItem(db.Model):
    """Maps an Eventure event or stage to the Google Calendar event created for it."""
    __tablename__ = "synced_items"
    __table_args__ = (db.UniqueConstraint("user_id", "kind", "ref_id", name="uq_synced_item"),)
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    kind = db.Column(db.String(10), nullable=False)  # "event" (a user_event) or "stage"
    ref_id = db.Column(db.Integer, nullable=False)
    google_event_id = db.Column(db.String(200), nullable=False)


class PushSubscription(db.Model):
    __tablename__ = "push_subscriptions"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    endpoint = db.Column(db.String(800), unique=True, nullable=False)
    p256dh = db.Column(db.String(200), nullable=False)
    auth = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
