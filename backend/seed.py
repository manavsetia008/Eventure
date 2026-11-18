"""Load demo data.  python seed.py          (adds data if the database is empty)
                   python seed.py --reset  (wipes everything first)
Demo login: demo@eventure.app / demo1234
Dates are relative to today, so the clash and deadline demo always works."""
import json
import sys
from datetime import date, datetime, time, timedelta

from app import create_app
from app.extensions import db
from app.models import (Club, ClubFollow, Event, ExamPeriod, InboxItem, Review, Stage, Team, TeamMember, User, UserEvent)
from app.services.extraction import extract_with_rules

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
        sat = today + timedelta(days=(5 - today.weekday()) % 7 or 7)
        next_mon = sat + timedelta(days=2)

        demo = user("Demo Student", "demo@eventure.app", "Main Campus", "hackathon, ai, web")
        student_b = user("Alex Morgan (Design Profile)", "student2@eventure.app", "North Campus", "design, ui, ux")
        riya = user("Riya Verma", "riya@eventure.app", "North Campus")
        kabir = user("Kabir Singh", "kabir@eventure.app", "West Institute")
        meera = user("Meera Nair", "meera@eventure.app", "City University")
        db.session.flush()

        c1 = Club(name="Code Collective", college="Main Campus", description="Hackathons, open source and weekly build nights.", created_by=demo.id)
        c2 = Club(name="Robotics Circle", college="North Campus", description="Robotics workshops and the annual expo.", created_by=riya.id)
        c3 = Club(name="AI Society", college="West Institute", description="Study groups, ML workshops and contests.", created_by=kabir.id)
        c4 = Club(name="Open Source Guild", college="City University", description="Cross-campus open source sprints.", created_by=meera.id)
        db.session.add_all([c1, c2, c3, c4])
        db.session.flush()
        for u, c in [(demo, c1), (demo, c3), (riya, c2), (kabir, c3), (meera, c4), (riya, c1)]:
            db.session.add(ClubFollow(user_id=u.id, club_id=c.id))

        # Upcoming events: the clash demo
        hack_x = event("Tech Fest Finale", "Unstop", "hackathon", "Main Campus, Hall A", "Main Campus",
                       at(sat, 10), at(sat, 18), "24-hour build on AI for campus life.", reg=at(today + timedelta(days=2), 23, 59), club=c1,
                       url="https://unstop.com", owner=demo)
        work_y = event("Cloud Workshop", "Townscript", "workshop", "North Campus, Lab 3", "North Campus",
                       at(sat, 14), at(sat, 17), "Hands-on deployment workshop.", club=c2)
        contest_z = event("Competitive Coding Sprint", "Unstop", "contest", "West Institute, Hall B", "West Institute",
                          at(next_mon + timedelta(days=2), 11), at(next_mon + timedelta(days=2), 14), "Individual coding contest.",
                          reg=at(sat + timedelta(days=1), 23, 59), club=c3)
        # Events to discover
        event("Web Build Day", "Devfolio", "hackathon", "City University, Main Audi", "City University", at(sat + timedelta(days=14), 9), at(sat + timedelta(days=14), 21),
              "Build with the open web stack. Prizes for the best demos.", reg=at(sat + timedelta(days=10), 23, 59), club=c4)
        event("ML Study Jam", "Commudle", "workshop", "West Institute, Hall B", "West Institute", at(sat + timedelta(days=9), 15), at(sat + timedelta(days=9), 18),
              "Intro to applied machine learning.", club=c3)
        event("Product Case Contest", "Unstop", "contest", "North Campus, Lab 3", "North Campus", at(sat + timedelta(days=12), 10), at(sat + timedelta(days=12), 16),
              "Solve a real product case in teams of 3.", reg=at(sat + timedelta(days=8), 23, 59), club=c2)
        event("Open Source Sprint", "Luma", "workshop", "Main Campus, Hall A", "Main Campus", at(sat + timedelta(days=20), 10), at(sat + timedelta(days=20), 17),
              "Fix issues, learn git workflows, ship your first PR.", club=c1, owner=demo)
        event("Campus Tech Summit", "Eventbrite", "conference", "City University, Main Audi", "City University", at(sat + timedelta(days=27), 9), at(sat + timedelta(days=27), 17),
              "Talks from engineers and founders.", club=c4)

        # Past events with verified reviews
        past1 = event("DevSprint 2026", "Devfolio", "hackathon", "Main Campus, Hall A", "Main Campus", at(today - timedelta(days=21), 10), at(today - timedelta(days=21), 20),
                      "A one-day build sprint.", club=c1, owner=demo)
        past2 = event("AI Workshop Series", "Commudle", "workshop", "West Institute, Hall B", "West Institute", at(today - timedelta(days=14), 14), at(today - timedelta(days=14), 17),
                      "Three-hour hands-on session.", club=c3)
        past3 = event("Robotics Expo", "Townscript", "fest", "North Campus, Lab 3", "North Campus", at(today - timedelta(days=9), 10), at(today - timedelta(days=9), 17),
                      "Project showcase and demos.", club=c2)

        def journey(u, ev, status, stages=()):
            ue = UserEvent(user_id=u.id, event_id=ev.id, status=status)
            db.session.add(ue)
            db.session.flush()
            for name, due, done in stages:
                db.session.add(Stage(user_event_id=ue.id, name=name, due_at=due, done=done))
            return ue

        # Demo student's timeline
        journey(demo, hack_x, "registered", [
            ("Register", at(today - timedelta(days=3), 23, 59), True),
            ("Submit", at(today + timedelta(days=5), 18), False),
            ("Shortlist", at(sat + timedelta(days=6), 12), False),
        ])
        journey(demo, work_y, "interested")
        journey(demo, contest_z, "interested", [("Register", contest_z.registration_deadline, False)])
        journey(demo, past1, "attended")
        db.session.add(ExamPeriod(user_id=demo.id, label="sessionals", start_date=next_mon + timedelta(days=7), end_date=next_mon + timedelta(days=11)))

        # Student B's timeline
        journey(student_b, hack_x, "interested", [("Submit", at(today + timedelta(days=5), 18), False)])

        # Verified reviews
        def review(u, ev, org, learn, val, text):
            journey(u, ev, "attended")
            db.session.add(Review(event_id=ev.id, user_id=u.id, organisation=org, learning=learn, value=val,
                                  overall=round((org + learn + val) / 3, 1), comment=text))

        review(riya, past1, 5, 4, 5, "Well run, mentors were around all night. Worth the trip.")
        review(kabir, past1, 4, 5, 4, "Great problem statements. Food queue was slow.")
        review(meera, past1, 4, 4, 3, "Good event but far from my campus.")
        review(riya, past2, 3, 5, 4, "Hands-on and practical. Starts late though.")
        review(kabir, past2, 4, 4, 4, "Solid intro. Bring a laptop.")
        review(meera, past3, 3, 3, 2, "Mostly stalls, not much to learn.")

        team = Team(name="Team Nexus", code="NEXUS", owner_id=demo.id)
        db.session.add(team)
        db.session.flush()
        for u in (demo, riya, kabir):
            db.session.add(TeamMember(team_id=team.id, user_id=u.id))
        db.session.flush()
        hx = UserEvent.query.filter_by(user_id=demo.id, event_id=hack_x.id).first()
        hx.team_id = team.id
        for u in (riya, kabir):
            journey(u, hack_x, "registered", [("Submit", at(today + timedelta(days=2), 18), False)]).team_id = team.id

        # Forwarded email waiting in demo student's Inbox
        fwd_day = sat + timedelta(days=16)
        mail_text = (f"AI Innovation Challenge\nVenue: Main Campus, Hall A\n{fwd_day.day} {fwd_day:%b %Y}, 10:00 AM to 6:00 PM\n"
                     f"Registrations close {(fwd_day - timedelta(days=5)).day} {(fwd_day - timedelta(days=5)):%b %Y}\nRegister on https://devfolio.co/ai-innovation")
        db.session.add(InboxItem(user_id=demo.id, message_id="seed-1", sender="events@campus.example", subject="Fwd: AI Innovation Challenge",
                                 body=mail_text, parsed=json.dumps(extract_with_rules(mail_text, datetime.now())), status="pending"))

        db.session.commit()
        print("Seeded. Sign in with demo@eventure.app / demo1234")


if __name__ == "__main__":
    main()
