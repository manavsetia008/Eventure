"""Load demo data.

    python seed.py            (adds data only if the database is empty)
    python seed.py --reset    (wipes everything first, then re-seeds)

Demo login: demo@eventure.app / demo1234

Notes
-----
* Every date is computed relative to `today`, so the demo never goes stale:
  deadlines, clashes and the exam overlap stay in the future forever.
* Data is generic on purpose: no real colleges, clubs or people.
* Only the demo student gets a populated timeline. A brand-new signed-up
  account starts empty because this script is not part of normal signup.
* Re-run with --reset any time to hand back a fresh, pristine demo state.
"""
import json
import sys
from datetime import date, datetime, time, timedelta

from app import create_app
from app.extensions import db
from app.models import (Club, ClubFollow, Event, ExamPeriod, InboxItem, Notification, Review, Stage,
                        Team, TeamMember, User, UserEvent, TrackedPortal)
from app.services.extraction import extract_with_rules

# Generic campus anchors (no real institution names).
COLLEGES = {
    "Main Campus": (28.5459, 77.2732),
    "City University": (28.5450, 77.1926),
    "North Campus": (28.7500, 77.1170),
    "West Institute": (28.6090, 77.0370),
}


def at(d, h, m=0):
    return datetime.combine(d, time(h, m))


def user(name, email, college, goals=""):
    lat, lng = COLLEGES[college]
    u = User(name=name, email=email, college=college, college_lat=lat, college_lng=lng, goals=goals)
    u.set_password("demo1234")
    db.session.add(u)
    return u


def event(title, platform, category, venue, college, start, end, desc="", reg=None, club=None, url=None, owner=None):
    lat, lng = COLLEGES[college]
    e = Event(title=title, platform=platform, category=category, venue_name=venue, lat=lat, lng=lng,
              start_at=start, end_at=end, description=desc, registration_deadline=reg,
              club_id=club.id if club else None, url=url, is_public=True, created_by=owner.id if owner else None)
    db.session.add(e)
    db.session.flush()
    return e


def main():
    app = create_app()
    with app.app_context():
        if "--reset" in sys.argv:
            db.drop_all()
            db.create_all()
        if User.query.first():
            print("Database already has data. Use --reset to start over.")
            return

        today = date.today()
        # Anchor to the coming Saturday so the demo always reads like a real week.
        sat = today + timedelta(days=(5 - today.weekday()) % 7 or 7)

        def d(n):
            """A date n days from today — keeps every seed date in the future."""
            return today + timedelta(days=n)

        # ── People (all generic; no real names) ──────────────────────────
        demo = user("Demo Student", "demo@eventure.app", "Main Campus", "AI, Web Development, Design")
        p_design = user("Design Student", "design.student@eventure.app", "North Campus", "design, ui, ux")
        p_robotics = user("Robotics Student", "robotics.student@eventure.app", "North Campus", "robotics, hardware")
        p_ai = user("AI Club Member", "ai.member@eventure.app", "West Institute", "ai, machine learning")
        p_os = user("Open Source Student", "oss.student@eventure.app", "City University", "web, open source")
        db.session.flush()

        # ── Campus communities ───────────────────────────────────────────
        c1 = Club(name="Code Collective", college="Main Campus", description="Hackathons, open source and weekly build nights.", created_by=demo.id)
        c2 = Club(name="Robotics Circle", college="North Campus", description="Robotics workshops and the annual expo.", created_by=p_robotics.id)
        c3 = Club(name="AI Society", college="West Institute", description="Study groups, ML workshops and contests.", created_by=p_ai.id)
        c4 = Club(name="Design Guild", college="City University", description="Design critiques, portfolio reviews and jams.", created_by=p_design.id)
        db.session.add_all([c1, c2, c3, c4])
        db.session.flush()
        for u, c in [(demo, c1), (demo, c3), (demo, c4), (p_robotics, c2), (p_ai, c3), (p_design, c4), (p_os, c1)]:
            db.session.add(ClubFollow(user_id=u.id, club_id=c.id))

        # ── Hackathons with multi-stage journeys ─────────────────────────
        hack_a = event("Campus Hack Sprint", "Unstop", "hackathon", "Main Campus, Hall A", "Main Campus",
                       at(d(3), 10), at(d(4), 18),
                       "24-hour campus build across tracks: AI, web and design.",
                       reg=at(d(1), 23, 59), club=c1, url="https://unstop.com", owner=demo)
        hack_b = event("AI Build Challenge", "Devfolio", "hackathon", "West Institute, Innovation Lab", "West Institute",
                       at(d(11), 9), at(d(12), 21),
                       "Ship an AI product in 36 hours. Mentors from the AI Society.",
                       reg=at(d(6), 23, 59), club=c3, url="https://devfolio.co")
        hack_c = event("Design-a-thon", "Hack2skill", "hackathon", "City University, Main Audi", "City University",
                       at(d(8), 10), at(d(8), 20),
                       "A one-day design sprint: pick a campus problem, ship a prototype.",
                       reg=at(d(4), 23, 59), club=c4, url="https://hack2skill.com")
        hack_d = event("Open Source Jam", "Hack2skill", "hackathon", "Main Campus, Lab 2", "Main Campus",
                       at(d(18), 10), at(d(18), 18),
                       "Pair on good-first-issues and land your first pull request.",
                       reg=at(d(14), 23, 59), club=c1, url="https://hack2skill.com")

        # ── Workshops (one clashes with the fest below) ──────────────────
        work_cloud = event("Cloud Deployment Workshop", "Townscript", "workshop", "North Campus, Lab 3", "North Campus",
                           at(sat, 14), at(sat, 17),
                           "Hands-on deployment: containers, env vars and a live URL.", club=c2)
        work_ml = event("Intro to Applied ML", "Commudle", "workshop", "West Institute, Hall B", "West Institute",
                        at(d(5), 15), at(d(5), 18),
                        "Train your first model and evaluate it honestly.", club=c3)

        # ── Fest (overlaps the Cloud Workshop → clash demo) ──────────────
        fest = event("Annual Tech Fest", "Eventbrite", "fest", "North Campus, Open Grounds", "North Campus",
                     at(sat, 15), at(sat, 21),
                     "Stalls, demos, a mini concert and club showcases all evening.", club=c2)

        # ── Coding contest ───────────────────────────────────────────────
        contest = event("Weekly Coding Contest", "Unstop", "contest", "West Institute, Hall B", "West Institute",
                        at(d(7), 18), at(d(7), 21),
                        "Three problems, ninety minutes, individual scoring.",
                        reg=at(d(6), 20), club=c3, url="https://unstop.com")

        # ── Deadline-only item (no fixed start time) ─────────────────────
        deadline_item = event("Scholarship Application", None, "other", None, "Main Campus",
                              None, None,
                              "Submit the merit scholarship form before the portal closes.",
                              reg=at(d(9), 23, 59), url="https://example.edu/scholarships")

        # ── Discover-only events (public, not on demo's timeline) ────────
        event("Web Build Day", "Devfolio", "hackathon", "City University, Main Audi", "City University",
              at(d(16), 9), at(d(16), 21), "Build with the open web stack. Prizes for the best demos.",
              reg=at(d(12), 23, 59), club=c4, url="https://devfolio.co")
        event("ML Study Jam", "Commudle", "workshop", "West Institute, Hall B", "West Institute",
              at(d(13), 15), at(d(13), 18), "Intro to applied machine learning.", club=c3)
        event("Product Case Contest", "Unstop", "contest", "North Campus, Lab 3", "North Campus",
              at(d(15), 10), at(d(15), 16), "Solve a real product case in teams of three.",
              reg=at(d(11), 23, 59), club=c2, url="https://unstop.com")
        event("Design Portfolio Review", "Luma", "workshop", "City University, Studio 1", "City University",
              at(d(20), 11), at(d(20), 14), "Bring three pieces, leave with clear feedback.", club=c4)
        event("Robotics Expo", "Townscript", "fest", "North Campus, Open Grounds", "North Campus",
              at(d(24), 10), at(d(24), 17), "Project showcase, line-followers and a sumo ring.", club=c2)
        event("Campus Tech Summit", "Eventbrite", "conference", "City University, Main Audi", "City University",
              at(d(27), 9), at(d(27), 17), "Talks from engineers and founders.", club=c4)
        event("Inter-College Quiz", "Unstop", "contest", "Main Campus, Hall A", "Main Campus",
              at(d(30), 16), at(d(30), 18), "General tech and current affairs quiz.", reg=at(d(28), 23, 59), url="https://unstop.com")
        event("Intro to Git", "Commudle", "workshop", "Main Campus, Lab 2", "Main Campus",
              at(d(6), 11), at(d(6), 13), "Branch, merge and fix a conflict live.", club=c1)

        # ── Past events (for verified reviews) ───────────────────────────
        past1 = event("DevSprint", "Devfolio", "hackathon", "Main Campus, Hall A", "Main Campus",
                      at(d(-21), 10), at(d(-21), 20), "A one-day build sprint.", club=c1, owner=demo)
        past2 = event("AI Workshop Series", "Commudle", "workshop", "West Institute, Hall B", "West Institute",
                      at(d(-14), 14), at(d(-14), 17), "Three-hour hands-on session.", club=c3)
        past3 = event("Robotics Demo Day", "Townscript", "fest", "North Campus, Lab 3", "North Campus",
                      at(d(-9), 10), at(d(-9), 17), "Project showcase and demos.", club=c2)

        # ── Journey helper ───────────────────────────────────────────────
        def journey(u, ev, status, stages=(), score=None, team=None):
            ue = UserEvent(user_id=u.id, event_id=ev.id, status=status, custom_score=score, team_id=team.id if team else None)
            db.session.add(ue)
            db.session.flush()
            for name, due, done in stages:
                db.session.add(Stage(user_event_id=ue.id, name=name, due_at=due, done=done))
            return ue

        # ── Demo student's timeline (varied statuses + Keep/Maybe/Skip) ──
        journey(demo, hack_a, "registered", [
            ("Register", at(d(-3), 23, 59), True),
            ("Submit", at(d(4), 20), False),
            ("Shortlist", at(d(8), 12), False),
            ("Final", at(d(10), 16), False),
        ], score=78)  # Keep
        journey(demo, hack_b, "registered", [
            ("Register", at(d(6), 23, 59), True),
            ("Submit", at(d(11), 23, 59), False),
            ("Shortlist", at(d(15), 12), False),
        ], score=72)  # Keep
        journey(demo, hack_c, "interested", [
            ("Register", at(d(4), 23, 59), True),
            ("Submit", at(d(8), 9), False),
        ], score=64)  # Keep
        journey(demo, hack_d, "interested", [("Register", at(d(14), 23, 59), False)], score=52)  # Maybe
        journey(demo, work_cloud, "registered", [], score=58)  # Keep
        journey(demo, work_ml, "interested", [], score=48)  # Maybe
        journey(demo, fest, "interested", [], score=66)  # Keep
        journey(demo, contest, "registered", [("Register", at(d(6), 20), True)], score=55)  # Maybe
        journey(demo, deadline_item, "interested", [], score=35)  # Skip
        journey(demo, past3, "skipped", [], score=28)  # Skip (already skipped)
        journey(demo, past1, "attended", [])

        # ── Exam period that overlaps the Design-a-thon (exam alert demo) ─
        db.session.add(ExamPeriod(user_id=demo.id, label="Sessionals", start_date=d(6), end_date=d(10)))

        # ── Peer timelines (keeps community/teams lively) ────────────────
        journey(p_design, hack_c, "interested", [("Submit", at(d(8), 9), False)])
        journey(p_ai, hack_b, "registered", [("Submit", at(d(11), 23, 59), False)])

        # ── Verified reviews (only from students who attended) ───────────
        def review(u, ev, org, learn, val, text):
            journey(u, ev, "attended")
            db.session.add(Review(event_id=ev.id, user_id=u.id, organisation=org, learning=learn, value=val,
                                  overall=round((org + learn + val) / 3, 1), comment=text))

        review(p_design, past1, 5, 4, 5, "Well run, mentors were around all night. Worth the trip.")
        review(p_ai, past1, 4, 5, 4, "Great problem statements. Food queue was slow.")
        review(p_os, past1, 4, 4, 3, "Good event but far from my campus.")
        review(p_design, past2, 3, 5, 4, "Hands-on and practical. Starts late though.")
        review(p_ai, past2, 4, 4, 4, "Solid intro. Bring a laptop.")
        review(p_os, past3, 3, 3, 2, "Mostly stalls, not much to learn.")

        # ── A shared team on the first hackathon ─────────────────────────
        team = Team(name="Team Nexus", code="NEXUS", owner_id=demo.id)
        db.session.add(team)
        db.session.flush()
        for u in (demo, p_design, p_ai):
            db.session.add(TeamMember(team_id=team.id, user_id=u.id))
        db.session.flush()
        hx = UserEvent.query.filter_by(user_id=demo.id, event_id=hack_a.id).first()
        hx.team_id = team.id
        journey(p_design, hack_a, "registered", [("Submit", at(d(4), 20), False)], team=team)
        journey(p_ai, hack_a, "registered", [("Submit", at(d(4), 20), False)], team=team)

        # ── Tracked portals with realistic "last checked" values ─────────
        portals = [
            ("Unstop", "unstop.com", datetime.now() - timedelta(minutes=25)),
            ("Devfolio", "devfolio.co", datetime.now() - timedelta(hours=2)),
            ("Hack2skill", "hack2skill.com", datetime.now() - timedelta(days=1, hours=3)),
        ]
        for name, domain, last in portals:
            db.session.add(TrackedPortal(user_id=demo.id, name=name, domain_or_name=domain,
                                         registered_email=demo.email, auto_sync=True, last_synced_at=last))

        # ── Notifications (deadline reminder, match, clash) ──────────────
        notes = [
            ("Deadline in 2 days: Register for the Design-a-thon.", "warning", "seed-deadline-1", False),
            ("New matching event: AI Build Challenge fits your interests.", "info", "seed-match-1", False),
            ("Schedule clash on Saturday: Cloud Deployment Workshop overlaps the Annual Tech Fest.", "warning", "seed-clash-1", False),
            ("Campus Hack Sprint submission deadline is this Saturday.", "info", "seed-deadline-2", True),
        ]
        for message, level, key, read in notes:
            db.session.add(Notification(user_id=demo.id, message=message, level=level, dedupe_key=key, read=read))

        # ── Forwarded emails waiting in the demo Inbox ───────────────────
        fwd_day = sat + timedelta(days=16)

        def inbox(message_id, sender, subject, body):
            db.session.add(InboxItem(user_id=demo.id, message_id=message_id, sender=sender, subject=subject,
                                     body=body, parsed=json.dumps(extract_with_rules(body, datetime.now())),
                                     status="pending"))

        mail_text = (f"AI Innovation Challenge\nVenue: Main Campus, Hall A\n{fwd_day.day} {fwd_day:%b %Y}, 10:00 AM to 6:00 PM\n"
                     f"Registrations close {(fwd_day - timedelta(days=5)).day} {(fwd_day - timedelta(days=5)):%b %Y}\nRegister on https://devfolio.co/ai-innovation")
        inbox("seed-1", "events@campus.example", "Fwd: AI Innovation Challenge", mail_text)

        mail_text2 = (f"Robotics Expo\nVenue: North Campus, Open Grounds\n{fwd_day.day} {fwd_day:%b %Y}, 10:00 AM to 5:00 PM\n"
                      f"Team registrations close {(fwd_day - timedelta(days=4)).day} {(fwd_day - timedelta(days=4)):%b %Y}\nSign up on https://townscript.com/robotics-expo")
        inbox("seed-2", "clubs@campus.example", "Fwd: Robotics Expo — register your team", mail_text2)

        mail_text3 = (f"Design Portfolio Review\nVenue: City University, Studio 1\n{fwd_day.day} {fwd_day:%b %Y}, 11:00 AM to 2:00 PM\n"
                      f"Bring three pieces of work. Reserve a slot at https://lu.ma/design-review")
        inbox("seed-3", "design.guild@campus.example", "Fwd: Portfolio review slots open", mail_text3)

        mail_text4 = ("Fwd: Hackathon kickoff kal 2 baje Audi 2 me hai. Stage 1 abstract review aur PPT check hoga.\n"
                      "Registration deadline tonight 11:59 PM.\nLink: https://unstop.com/hackathons/campus-hackathon-2026")
        inbox("seed-4", "batch.group@campus.example", "Fwd: Hackathon kickoff details", mail_text4)

        db.session.commit()
        print("Seeded. Sign in with demo@eventure.app / demo1234")


if __name__ == "__main__":
    main()
