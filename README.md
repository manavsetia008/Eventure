# Eventure

> **Every event, one thread.**
> Turn scattered campus notices into one clear, trackable timeline.

Eventure is a tracker for college students juggling events and hackathons. Paste a notice or a
WhatsApp forward and it pulls out the title, venue, dates and deadlines. From there you track every
stage, spot schedule and exam-week clashes, and decide what to keep.

---

## What it does

- **Capture** — paste notice text or upload a poster; details are extracted for review and you can edit any field before saving.
- **Timeline** — each event with its stages (registration, submission, shortlist, final), days-left and deadlines.
- **Clash detection** — overlapping events, tight travel gaps between venues, and clashes with your saved exam dates.
- **Keep / Skip** — a 0–100 fit score from your interests, deadlines and campus distance, with a threshold you control.
- **Discover** — browse public events, filter and sort, and compare two to four side by side.
- **Inbox** — forwarded event emails land here as ready-to-review drafts.
- **Community & Organizer** — follow campus clubs, and create or manage the events you organise.
- **Portals, exam dates, calendar** — track the platforms you register on, save your exam window, and subscribe to a private calendar feed.

---

## Stack

| Layer | Choice |
|---|---|
| Backend | Flask 3, SQLAlchemy, PyJWT, APScheduler |
| Database | SQLite by default (`backend/eventure.db`); PostgreSQL optional |
| Frontend | React 18 + Vite 5, react-router-dom |
| Styling | Plain CSS with a single set of CSS variables (`frontend/src/styles.css`) |
| Icons / Map | lucide-react, Leaflet |
| Tests | pytest (92 backend), Vitest (18 frontend) |

---

## Project layout

```
eventure/
├─ backend/
│  ├─ app/
│  │  ├─ routes/        # auth, timeline, discover, social, inbox, organizer, google, push, integrations
│  │  ├─ services/      # extraction, ocr, conflicts, priority, travel, inbox, reminders, push, calendar, ics
│  │  ├─ models.py      # SQLAlchemy models
│  │  ├─ config.py      # reads backend/.env
│  │  └─ __init__.py    # app factory + /api/health
│  ├─ tests/            # pytest suites
│  ├─ seed.py           # demo data (dates are relative to today)
│  └─ run.py            # entry point
└─ frontend/
   ├─ src/
   │  ├─ pages/         # Landing, Timeline, Discover, AddEvent, Inbox, Community, Organizer, Settings...
   │  ├─ components/    # Badge, Chip, Checkbox, Radio, EventForm, IssueCard...
   │  ├─ styles.css     # theme tokens + all styles
   │  └─ api.js         # fetch wrapper (attaches the JWT)
   └─ index.html        # inline theme bootstrap (no flash on load)
```

Frontend routes: `/` (Timeline when signed in, otherwise the landing page), `/login`, `/signup`,
`/add`, `/discover`, `/events/:id`, `/events/:id/edit`, `/inbox`, `/community`, `/organizer`,
`/notifications`, `/settings`.

---

## Getting started

Prerequisites: **Python 3.11+** and **Node.js 18+**.

### 1. Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env            # macOS/Linux: cp .env.example .env

python seed.py --reset            # load demo data
python run.py                     # http://localhost:5000
```

The app starts with **no API keys**. Extraction, clash detection, travel time and the calendar feed
all work offline; any key that is missing simply switches that one feature to a built-in fallback.

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

### Demo account

```
demo@eventure.app  /  demo1234
```

`python seed.py --reset` wipes and re-creates demo data using `today + N days`, so deadlines,
clashes and the exam overlap never go stale. It seeds events, hackathons with stages, a schedule
clash, an exam-week clash, tracked portals, inbox items, clubs and notifications.

---

## Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in only what you need. **Everything is optional.**

| Variable | Used for | Where to get it | Cost |
|---|---|---|---|
| `SECRET_KEY` | Signs auth tokens (required in production) | Any long random string | Free |
| `DATABASE_URL` | Database connection (default: SQLite) | Your Postgres URL, or leave blank | Free / paid |
| `CORS_ORIGINS` | Allowed frontend origins (default `http://localhost:5173`) | — | Free |
| `TIMEZONE` | Calendar and push times (default `Asia/Kolkata`) | — | Free |
| `FRONTEND_URL` | Redirect target after Google OAuth | — | Free |
| `APP_BASE_URL` | Public origin used to build the Google sign-in callback | `http://localhost:5173` in dev, live domain in prod | Free |
| `SARVAM_API_KEY` | Notice extraction from text, poster OCR, Indic translation | dashboard.sarvam.ai | Free credits, then paid |
| `SARVAM_MODEL` | Sarvam model id (default `sarvam-105b-conversations`) | Sarvam docs | — |
| `GOOGLE_MAPS_API_KEY` | Real traffic travel times | Google Cloud Console | Paid (free credit) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Calendar sync | Google Cloud Console → OAuth client | Free |
| `GOOGLE_REDIRECT_URI` | OAuth callback (must match the console) | — | Free |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Browser push reminders | Generate with `python scripts/generate_vapid_keys.py` | Free |
| `INBOX_ADDRESS` | Address students forward event emails to | Your own mailbox plus a domain | Free |
| `IMAP_HOST` / `IMAP_PORT` / `IMAP_USER` / `IMAP_PASSWORD` | Poll that mailbox for forwards | Your mail provider | Free |
| `INBOUND_SECRET` | Protects the inbound-email webhook | Any random string | Free |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Optional email reminders | Your SMTP provider | Free / paid |
| `ENABLE_SCHEDULER`, `REMINDER_INTERVAL_MINUTES`, `IMAP_POLL_MINUTES` | Background reminder and poll cadence | — | Free |
| `AUTO_CREATE_DB` | Create tables on boot (set `0` when using Flask-Migrate) | — | Free |
| `TRUST_PROXY` | Set to `1` behind nginx / Render / Railway | — | Free |

**Behaviour when a key is missing** (the app never crashes):

- **Extraction** falls back to the built-in rule-based parser, which still finds dates, venue, deadline and link. The UI offers "Fill in manually".
- **Travel time** is estimated from straight-line distance when no maps key is set; if it cannot be estimated the row simply reads "Travel time unavailable".
- **Google Calendar, push notifications and email forwarding** stay off; the rest of the app is unaffected.

---

## Google sign-in setup

The "Continue with Google" button on `/login` and `/signup` uses the same OAuth client as the
Calendar sync. It stays hidden until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set, so the
app keeps working without them.

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com).
2. Fill in the **OAuth consent screen**: User type **External**, app name **Eventure**, a support
   email, and only the `email` and `profile` scopes. Before a demo, click **Publish app** — while the
   app is in "Testing" only listed test users can sign in.
3. Go to **Credentials → Create credentials → OAuth client ID → Web application**.
4. Under **Authorized JavaScript origins** add `http://localhost:5173` and, later, your live domain.
5. Under **Authorized redirect URIs** add both:
   - `http://localhost:5173/auth/google/callback`
   - `https://YOUR_DOMAIN/auth/google/callback`
6. Paste the client ID and secret into `backend/.env` and restart the app.
7. Google does not accept a local IP (like `192.168.x.x`) as a redirect origin — open the app from
   `localhost` while developing.

If `APP_BASE_URL` points somewhere other than `http://localhost:5173`, use that origin in steps 4
and 5 instead.

---

## API

Everything lives under `/api`. Except for auth, the health check and the calendar feed, endpoints
expect a `Bearer <token>` from `POST /api/auth/login`.

| Group | Prefix | Examples |
|---|---|---|
| Auth | `/api/auth` | `POST /register`, `POST /login`, `GET|PUT|DELETE /me` |
| Events & timeline | `/api` | `POST /extract`, `POST /events`, `PUT /events/:id`, `GET /timeline`, `PATCH /user-events/:id`, `POST /user-events/:id/stages` |
| Exams, portals, notifications | `/api` | `GET|POST /exams`, `GET|POST|PATCH|DELETE /portals`, `POST /portals/:id/sync`, `GET /notifications`, `GET /calendar.ics` |
| Discover & compare | `/api` | `GET /discover`, `GET /events/:id`, `POST /events/:id/join`, `POST /events/:id/reviews`, `GET /compare` |
| Community | `/api` | `GET|POST /clubs`, `POST /clubs/:id/follow`, `GET|POST /teams`, `POST /teams/join` |
| Inbox | `/api` | `GET /inbox`, `POST /inbox/:id/dismiss`, `POST /inbound/email` |
| Organizer | `/api/organizer` | `GET /events`, `POST /events/:id/visibility` |
| Google Calendar | `/api/google` | `GET /connect`, `GET /callback`, `POST /sync`, `POST /disconnect` |
| Push | `/api/push` | `GET /key`, `POST /subscribe`, `POST /unsubscribe` |
| Integrations | `/api/integrations` | `GET /status`, `POST /test/:service` |

Health check: `GET /api/health` → `{"status": "ok"}`.

---

## Testing

```powershell
cd backend
python -m pytest tests -q          # 92 tests

cd ..\frontend
npm test                           # 18 tests
npm run lint
npm run build
```

The suites cover clash detection (overlap, travel gap, exam week), the priority/threshold scoring,
date and duration formatting, rate limiting, JWT lifecycle and the REST contract.

---

## Deploy

The backend serves the built frontend automatically when `frontend/dist` exists, so the whole app
can run on a single service.

**Build step:** `cd frontend && npm install && npm run build`

**Render / Railway / any VM**
- Start command: `cd backend && python run.py` (or `gunicorn "app:create_app()"`).
- Set the env vars from the table above. `SECRET_KEY` is required in production; set `TRUST_PROXY=1` behind a proxy.
- Point `DATABASE_URL` at a managed Postgres instance for persistence (otherwise SQLite keeps a local file).
- Optional one-time setup: `python seed.py --reset`.

**Vercel (frontend) + Render/Railway (backend)**
- Deploy `frontend` to Vercel with build command `npm run build` and output directory `dist`, and set `VITE_API_URL` to your backend URL plus `/api`.
- Deploy `backend` as above, then set `CORS_ORIGINS` and `FRONTEND_URL` to the Vercel URL.

**Docker**

```bash
docker compose up -d --build
```

---

## License

MIT — see [LICENSE](LICENSE).
