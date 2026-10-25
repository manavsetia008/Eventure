import secrets

from flask import Blueprint, g, jsonify, request

from ..auth import login_required
from ..extensions import db
from ..models import Club, ClubFollow, Event, Team, TeamMember, User, UserEvent
from ..utils import ApiError, iso, now, to_int

bp = Blueprint("social", __name__, url_prefix="/api")


def club_dict(club, following, followers):
    return {**club.to_dict(), "following": following, "followers": followers}


@bp.get("/clubs")
@login_required
def list_clubs():
    mine = {f.club_id for f in ClubFollow.query.filter_by(user_id=g.user.id).all()}
    counts = {}
    for f in ClubFollow.query.all():
        counts[f.club_id] = counts.get(f.club_id, 0) + 1
    clubs = Club.query.order_by(Club.name).all()
    return jsonify(clubs=[club_dict(c, c.id in mine, counts.get(c.id, 0)) for c in clubs])


@bp.post("/clubs")
@login_required
def create_club():
    d = request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()
    if not name:
        raise ApiError("Name the club or community.")
    club = Club(name=name[:150], college=(d.get("college") or g.user.college), description=(d.get("description") or "").strip(), created_by=g.user.id)
    db.session.add(club)
    db.session.flush()
    db.session.add(ClubFollow(user_id=g.user.id, club_id=club.id))
    db.session.commit()
    return jsonify(club=club_dict(club, True, 1)), 201


@bp.get("/clubs/<int:club_id>")
@login_required
def club_detail(club_id):
    club = db.session.get(Club, club_id)
    if not club:
        raise ApiError("That club does not exist.", 404)
    following = ClubFollow.query.filter_by(user_id=g.user.id, club_id=club.id).first() is not None
    followers = ClubFollow.query.filter_by(club_id=club.id).count()
    events = Event.query.filter(Event.club_id == club.id, Event.is_public.is_(True), Event.start_at >= now()).order_by(Event.start_at).all()
    return jsonify(club=club_dict(club, following, followers), events=[e.to_dict() for e in events])


@bp.post("/clubs/<int:club_id>/follow")
@login_required
def toggle_follow(club_id):
    if not db.session.get(Club, club_id):
        raise ApiError("That club does not exist.", 404)
    row = ClubFollow.query.filter_by(user_id=g.user.id, club_id=club_id).first()
    if row:
        db.session.delete(row)
        following = False
    else:
        db.session.add(ClubFollow(user_id=g.user.id, club_id=club_id))
        following = True
    db.session.commit()
    return jsonify(following=following, followers=ClubFollow.query.filter_by(club_id=club_id).count())


def _member_of(team_id):
    team = db.session.get(Team, team_id)
    if not team or not TeamMember.query.filter_by(team_id=team_id, user_id=g.user.id).first():
        raise ApiError("You are not part of that team.", 404)
    return team


@bp.get("/teams")
@login_required
def list_teams():
    ids = [m.team_id for m in TeamMember.query.filter_by(user_id=g.user.id).all()]
    teams = Team.query.filter(Team.id.in_(ids)).all() if ids else []
    return jsonify(teams=[{"id": t.id, "name": t.name, "code": t.code, "is_owner": t.owner_id == g.user.id} for t in teams])


@bp.post("/teams")
@login_required
def create_team():
    name = ((request.get_json(silent=True) or {}).get("name") or "").strip()
    if not name:
        raise ApiError("Name your team.")
    team = Team(name=name[:150], code=secrets.token_hex(3).upper(), owner_id=g.user.id)
    db.session.add(team)
    db.session.flush()
    db.session.add(TeamMember(team_id=team.id, user_id=g.user.id))
    db.session.commit()
    return jsonify(team={"id": team.id, "name": team.name, "code": team.code, "is_owner": True}), 201


@bp.post("/teams/join")
@login_required
def join_team():
    code = ((request.get_json(silent=True) or {}).get("code") or "").strip().upper()
    team = Team.query.filter_by(code=code).first()
    if not team:
        raise ApiError("No team has that code. Check it with your teammate.", 404)
    if not TeamMember.query.filter_by(team_id=team.id, user_id=g.user.id).first():
        db.session.add(TeamMember(team_id=team.id, user_id=g.user.id))
        db.session.commit()
    return jsonify(team={"id": team.id, "name": team.name, "code": team.code, "is_owner": team.owner_id == g.user.id})


@bp.get("/teams/<int:team_id>")
@login_required
def team_detail(team_id):
    team = _member_of(team_id)
    members = User.query.join(TeamMember, TeamMember.user_id == User.id).filter(TeamMember.team_id == team.id).all()
    ues = UserEvent.query.filter_by(team_id=team.id).all()
    by_event = {}
    for ue in ues:
        entry = by_event.setdefault(ue.event_id, {"event": ue.event.to_dict(), "members": [], "next_deadline": None})
        undone = [s for s in ue.stages if not s.done and s.due_at]
        nxt = min(undone, key=lambda s: s.due_at) if undone else None
        entry["members"].append({"user_id": ue.user_id, "name": ue.user.name, "status": ue.status,
                                 "next_deadline": {"name": nxt.name, "due_at": iso(nxt.due_at)} if nxt else None})
        if nxt and (entry["next_deadline"] is None or iso(nxt.due_at) < entry["next_deadline"]["due_at"]):
            entry["next_deadline"] = {"name": nxt.name, "due_at": iso(nxt.due_at)}
    events = sorted(by_event.values(), key=lambda e: e["event"]["start_at"] or "9999")
    return jsonify(team={"id": team.id, "name": team.name, "code": team.code},
                   members=[{"id": m.id, "name": m.name} for m in members], events=events)


@bp.post("/teams/<int:team_id>/events")
@login_required
def share_event(team_id):
    """Put one of your events on the team's shared journey and add it for every member."""
    team = _member_of(team_id)
    event_id = to_int((request.get_json(silent=True) or {}).get("event_id"))
    if event_id is None:
        raise ApiError("Pick an event to share.")
    mine = UserEvent.query.filter_by(user_id=g.user.id, event_id=event_id).first()
    if not mine:
        raise ApiError("Add the event to your own timeline first.", 404)
    mine.team_id = team.id
    for m in TeamMember.query.filter_by(team_id=team.id).all():
        ue = UserEvent.query.filter_by(user_id=m.user_id, event_id=event_id).first()
        if ue:
            ue.team_id = team.id
        else:
            db.session.add(UserEvent(user_id=m.user_id, event_id=event_id, status="interested", team_id=team.id))
    db.session.commit()
    return jsonify(ok=True)
