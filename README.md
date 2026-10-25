# Eventure

**Every event, one thread.** Students find events in one place, judge them in another, register on a third and plan the trip on a fourth. Eventure puts the whole journey in one app: discover on a map, decide with reviews from people who actually went, track every stage and deadline, and get told when two plans clash and which one to skip.

Built by Team Quanta (Manav Setia, Mayank Sharma, Milan Sharma). MIT licensed.

## Why it exists

- Event details are scattered across WhatsApp, Instagram, email, posters and platform dashboards, and each platform tracks only its own events.
- Calendars store events but do not tell you whether you can actually do them: clashes, travel time and exam weeks go unchecked.
- Free student events have no trustworthy rating layer. Eventure only accepts reviews from students who attended.

The research behind this is in [`docs/Eventure_Research_Brief.docx`](docs/Eventure_Research_Brief.docx).

## How it fits together

```mermaid
flowchart LR
  A["Poster, pasted text or forwarded email"] --> B["Reader: OCR + AI or built-in rules"]
  B --> C["Student confirms"]
  C --> D[("SQLite or PostgreSQL")]
  D --> E["Clash, travel and exam checks"]
  D --> F["Priority scoring and keep-or-skip"]
  D --> G["Verified reviews and ranking"]
  E --> H["React app"]
  F --> H
  G --> H
  D --> I["Alerts: in-app, push, email"]
  D --> J["Google Calendar and .ics feed"]
```

Tech: Flask, SQLAlchemy (SQLite or PostgreSQL), React with Vite, Leaflet and OpenStreetMap, Web Push, Google Calendar API. Installable as a PWA.

## Run it

You need Python 3.10+ and Node 18+.

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # optional, everything core works without edits
python seed.py                     # demo data (use --reset to wipe and reload)
python run.py                      # http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173 (proxies /api to Flask)
```

Sign in with `demo@eventure.app` / `demo1234`.

### 3. Check it works

```bash
cd backend
python -m unittest discover -s tests -v
```

39 tests cover the logic (clashes, scoring, parsing, email, geocoding, rate limits, Google helpers) and run anywhere. 16 more call the real API on an in-memory database and run once the requirements are installed.

## What it does

| Area | Feature |
|---|---|
| Track | Stage-wise timeline, deadline risk colours, team view, status per event |
| Check | Clashes, travel gaps (travel time plus 15 min), exam weeks, clashes with your own Google Calendar, keep-or-skip suggestions with reasons |
| Capture | Paste text, upload a poster (OCR), or forward an email to your private Inbox address. The venue is located on the map automatically (free OpenStreetMap lookup, or Google if you set a key) and you can correct it. You confirm before anything is saved |
| Discover | Map and list around your college, filters, "best for me" ranking, compare up to 3 events |
| Review | Reviews only from students who attended (checked by the API), one per student |
| Community | Clubs across campuses, follow, team journeys with invite codes |
| Organizer | Your listed events with interested, registered and attended counts, ratings, share link and "Add to Eventure" button code. Edit event details any time |
| Account | Delete your account and all your data from Settings. Repeated failed sign-ins and mass sign-ups are rate limited |
| Alerts | In-app, browser and phone push, optional email. Escalates only when a deadline is at risk |
| Calendars | Two-way Google Calendar sync, plus a private .ics feed for any calendar app |

## Connect the extras (all optional)

**PostgreSQL**: `docker compose up -d`, set `DATABASE_URL=postgresql://eventure:eventure@localhost:5432/eventure`, `pip install psycopg2-binary`.

**Poster reading**: install the Tesseract program (Windows installer, `brew install tesseract`, or `apt install tesseract-ocr`).

**AI extraction**: set `ANTHROPIC_API_KEY` (model in `ANTHROPIC_MODEL`). Without it the built-in rule-based parser is used.

**Travel times and venue lookup**: venues are located with free OpenStreetMap search (fine for a demo or a campus, see their usage policy before heavy use; switch off with `GEOCODE_OSM=0`). Set `GOOGLE_MAPS_API_KEY` (Distance Matrix and Geocoding APIs) for real road travel times and better venue matching. Without a key travel time is estimated from distance.

**Google Calendar sync**
1. Google Cloud Console: create a project and enable the Google Calendar API.
2. OAuth consent screen: choose External and add your own account as a test user.
3. Credentials: create an OAuth client ID of type Web application. Add `http://localhost:5000/api/google/callback` as an authorised redirect URI.
4. Put the client ID and secret in `backend/.env`, restart, then open Settings and press Connect Google Calendar.
While the Google app is in Testing mode, Google expires the login after about a week, so reconnect when sync stops. Eventure only creates, edits and deletes the events it made (they carry a private tag). It reads your other events to find clashes and never changes them.

**Browser and phone alerts**
1. `python scripts/generate_vapid_keys.py` and paste the two lines into `backend/.env`. Restart.
2. Settings, Phone and browser alerts, Turn on.
Push needs HTTPS except on localhost. On iPhone (iOS 16.4 or later) add Eventure to the Home Screen first and turn alerts on from there. This uses the Web Push standard, so no Firebase account is needed.

**Email forwarding**
- *Gmail option*: make a dedicated Gmail account, turn on 2-step verification, create an App Password. Set `INBOX_ADDRESS` to that address, `IMAP_HOST=imap.gmail.com`, `IMAP_USER`, `IMAP_PASSWORD`. Each student's private address, shown on the Inbox page, is `youraddress+<token>@gmail.com`. Gmail delivers it to the same mailbox and Eventure polls it every few minutes.
- *Provider option* (Mailgun, SendGrid, Postmark): point the inbound route to `POST /api/inbound/email`, set `INBOUND_SECRET`, and send the same value in the `X-Inbound-Secret` header. Fields read: `to`, `from`, `subject`, `text` or `html`, `message_id`, or a raw MIME `email`.

**Email reminders**: set the `SMTP_*` values.

**Schema migrations**: Eventure creates tables on start. For production set `AUTO_CREATE_DB=0` and use `flask --app run db init`, then `db migrate -m "init"` and `db upgrade`.
If you ran the first version of this project, delete `backend/eventure.db` and run `python seed.py` again, because new columns and tables were added.

## Deploy as one container

The Flask server also serves the built React app, so a single URL is enough for a demo or a small pilot.

```bash
docker build -t eventure .
docker run -p 8000:8000 -e SECRET_KEY=a-long-random-string eventure      # SQLite inside the container
# or with PostgreSQL:
docker compose --profile app up -d --build
docker compose --profile app exec app python seed.py                       # optional demo data
```

Without Docker: `cd frontend && npm run build`, then run the backend with `gunicorn -w 1 --threads 4 run:app`. Keep one worker so the reminder scheduler runs once. Behind a proxy (Render, Railway, nginx) set `TRUST_PROXY=1` so rate limits see each student's real address. The Dockerfile already sets it, so if you expose the container directly with no proxy in front, run it with `-e TRUST_PROXY=0`. For Google sign-in on a public URL, set `GOOGLE_REDIRECT_URI` to `https://your-domain/api/google/callback` and add it in the Google console. Push alerts need HTTPS.
I could not run Docker here, so the Dockerfile is untested.

## Demo script (about 4 minutes)

1. Sign in as the demo student. The timeline shows **Hackathon X** (submission due in 2 days, red dot) and a **clash** with Cloud Workshop Y, with "Keep Hackathon X" and the extra travel time. Click it to skip Workshop Y.
2. The sessional week flags **Contest Z** and suggests skipping it.
3. **Inbox**: a forwarded email is waiting, already read. Review and add it.
4. **Add event**: paste poster text, check the parsed fields, confirm.
5. **Discover**: map around your college, filters, compare 2 to 3 events.
6. Open **DevSprint 2026**. The demo student is marked as attended, so the review form appears. Every review there is from a verified attendee.
7. **Community**: follow clubs, open the **Team Quanta** shared journey.
8. **Organizer**: counts and ratings for events you listed, share link and button code.
9. **Alerts**: "Check my deadlines now" creates escalating reminders. **Settings**: connect Google Calendar, turn on push, copy the calendar feed.

## Project layout

```
backend/
  app/
    models.py             tables
    routes/               auth, timeline, discover, social, inbox, google, push, organizer
    services/
      extraction.py       LLM + rule-based event reader
      ocr.py              poster to text (Tesseract)
      inbox.py            email parsing and inbox ingestion
      imap_poll.py        mailbox polling
      conflicts.py        overlap, travel-gap, exam-week and calendar clashes
      priority.py         goal/deadline/travel scoring and keep-or-skip suggestions
      travel.py           Distance Matrix with an offline estimate
      google_calendar.py  OAuth, push to Google, read your calendar
      push.py             Web Push alerts
      reminders.py        escalating deadline alerts (scheduler job)
      ics.py              calendar feed
  scripts/generate_vapid_keys.py
  seed.py                 demo data with dates relative to today
Dockerfile, docker-compose.yml   one-container deployment, optional PostgreSQL
  tests/                  test_logic, test_integrations, test_api
frontend/
  public/                 manifest, service worker, icons
  src/pages/              Timeline, AddEvent, Inbox, Discover, EventDetail, Community, Organizer, Settings, Notifications, Login
  src/components/         IssueCard, MapView
```

## How the key parts work

- **Clash check**: overlapping events, gaps shorter than travel time plus 15 minutes, events inside your exam periods, and overlaps with your own Google Calendar events.
- **Priority score (0 to 100)**: goal fit (up to 40), deadline urgency (20), ease of travel (20), already registered (10), minus 25 inside exam time. Clashes suggest keeping the higher score and say why.
- **Reminders**: warning at 48 h, urgent at 24 h, critical at 6 h or just overdue. Each level fires once per stage and goes to the app, any enabled devices, and email if configured.
- **Verified reviews**: rejected unless the student has the event on their timeline as attended and the event has started.
- **Discover ranking**: smoothed average rating (50%), proximity (30%), fit with your goals (20%).
- **Times** are naive local campus times. Run the server in your campus time zone (`TZ=Asia/Kolkata`) and set `TIMEZONE` for Google.

## Known limits

- Google sync is one-way push plus read of your calendar. Edits you make to Eventure-created events in Google are overwritten at the next sync.
- Email parsing reads one event per email. Mails listing several events need to be split by hand.
- The calendar feed link carries your sign-in token. Treat it as private.
- Set a strong `SECRET_KEY` before deploying anywhere public.
- The rate limiter keeps counts in memory, so it resets on restart and is per process. It counts failed sign-ins (20 per 5 minutes per address) so a whole campus on one Wi-Fi is not locked out.
- Venue lookup can pick the wrong place for vague names (for example "Campus A"). The form shows the result and a map link so students can correct it.
