# Eventure

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-000000.svg)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-61%20Passing-success.svg)](#3-check-it-works)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Every event, one thread.** The unified timeline and decision engine for college hackathons, competitions, and campus events.

Built by **Team Quanta** for the CodeBreaker Hackathon:
- **Manav Setia** — Backend Lead & Architecture
- **Mayank Sharma** — API Engineering & External Integrations
- **Milan Sharma** — Frontend Lead & UI/UX Design

---

## Why Eventure Exists

College students frequently juggle multiple hackathons, coding contests, and workshops across platforms like WhatsApp, Unstop, Devfolio, and email:
- **Scattered Information:** Deadlines for abstract submissions, PPT rounds, and shortlist announcements get buried in chat groups.
- **Passive Calendars:** Traditional calendars only store dates—they don't calculate road commute times between campuses or flag clashes with university exam schedules.
- **Zero Trust Layer:** Free college events lack an authentic rating system. Eventure ensures reviews are strictly written by confirmed attendees.

---

## System Architecture

```mermaid
flowchart LR
  A["Poster (OCR), Text or Email Ingestion"] --> B["Extraction Engine (Rules / Heuristics)"]
  B --> C["Student Confirmation"]
  C --> D[("Relational DB (SQLite / PostgreSQL)")]
  D --> E["Clash, Travel Gap & Exam Checks"]
  D --> F["Priority Scoring (0-100) & Keep/Skip"]
  D --> G["Verified Reviews & Discover Ranking"]
  E --> H["React 18 Frontend"]
  F --> H
  G --> H
  D --> I["Escalating Alerts (App & Web Push)"]
  D --> J["Google Calendar & Private .ics Feed"]
```

**Tech Stack:**
- **Frontend:** React 18, Vite, Leaflet interactive mapping with CartoDB tiles, Web Push, installable PWA.
- **Backend:** Python Flask 3, SQLAlchemy ORM (15 relational tables), PyJWT stateless auth, APScheduler.
- **Database:** SQLite by default for zero-config local development; production-ready PostgreSQL via Docker.
- **External Services:** OpenStreetMap Nominatim geocoding, Google Calendar OAuth sync, .ics private feeds, Tesseract OCR.

---

## Getting Started

### Prerequisites
- **Python 3.10+**
- **Node.js 18+**

---

### 1. Backend Setup

Open a terminal (PowerShell on Windows):

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
# (On macOS/Linux: source .venv/bin/activate)

pip install -r requirements.txt
copy .env.example .env
# (On macOS/Linux: cp .env.example .env)

# Seed realistic demo data:
python seed.py

# Start the Flask backend server:
python run.py
```
> **Tip:** If `python seed.py` reports that the database already has data, use `python seed.py --reset` to reload fresh demo records.

The backend will start running at **`http://localhost:5000`**.

---

### 2. Frontend Setup

In a new terminal window:

```powershell
cd frontend
npm install

# Option A: Start Vite development server (hot-reload on port 5173):
npm run dev

# Option B: Build production bundle (Flask on port 5000 directly serves it):
npm run build
```

Open **`http://localhost:5000`** (or `http://localhost:5173` if running Vite dev server).

**Demo Credentials:**
- Email: `demo@eventure.app`
- Password: `demo1234`
*(Or use the 1-click **Auto-fill** button on the sign-in card).*

---

### 3. Check It Works (Automated Tests)

Run the backend unit test suite:

```powershell
cd backend
python -m unittest discover -s tests -v
```

**61 automated tests** run across:
- Conflict detection (overlaps, travel transit gaps, exam periods, personal calendars)
- Algorithmic priority scoring and keep-or-skip recommendations
- Poster text extraction and date inference
- Security rate limiting, JWT validation, and live API endpoints

---

## Core Capabilities

| Feature | Description |
|---|---|
| **Stage Timeline** | Multi-round checklists (abstract, prototype, presentation) with color-coded deadline alerts. |
| **Clash Radar** | Detects overlapping events, exam conflicts, and tight commute gaps (travel time + 15 min buffer). |
| **Keep-or-Skip Engine** | Evaluates goal fit, deadline urgency, travel ease, and exam penalties to advise which plan to keep. |
| **Smart Ingestion** | Upload flyers (OCR), paste notices, or forward emails to your private campus inbox token. |
| **Discover Map** | Interactive Leaflet campus map showing nearby hackathons with Bayesian-smoothed ratings. |
| **Verified Reviews** | Anti-tamper review system accepting ratings only from students confirmed to have attended. |
| **Escalating Alerts** | Background scheduler dispatching warnings at 48h, 24h, and 6h prior to stage deadlines. |
| **Calendar Sync** | Two-way Google Calendar push and a private `.ics` feed for Apple Calendar, Outlook, and mobile widgets. |

---

## Optional Integrations

- **PostgreSQL Database:** Run `docker compose up -d` and set `DATABASE_URL=postgresql://eventure:eventure@localhost:5432/eventure`.
- **Tesseract OCR:** Install Tesseract on your host machine to extract text directly from event poster image files.
- **Google Maps API:** Set `GOOGLE_MAPS_API_KEY` for live Distance Matrix road transit times (offline Haversine fallback included by default).
- **Google Calendar Sync:** Add OAuth Client ID and Secret in `backend/.env` to sync timeline stages directly into your Google Calendar.
- **Web Push Notifications:** Run `python scripts/generate_vapid_keys.py` to generate standard Web Push VAPID keys.

---

## Repository Structure

```
eventure/
├── backend/
│   ├── app/
│   │   ├── models.py             # 15 SQLAlchemy tables
│   │   ├── routes/               # Modular REST endpoints (auth, timeline, discover, etc.)
│   │   └── services/             # Decoupled business logic (conflicts, travel, priority, ocr)
│   ├── tests/                    # 61 unit and integration tests
│   ├── seed.py                   # Realistic multi-campus seed data
│   └── run.py                    # Application entrypoint
├── frontend/
│   ├── src/
│   │   ├── pages/                # Timeline, Discover, AddEvent, Settings, Login, etc.
│   │   ├── components/           # IssueCard, MapView, EventForm
│   │   └── styles.css            # Custom design system with high-contrast theme
│   └── package.json              # React 18, Vite 5, Leaflet dependencies
├── Dockerfile                    # Container definition
├── docker-compose.yml            # Multi-service setup (App + PostgreSQL)
└── README.md                     # Documentation
```

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details. Built with pride by Team Quanta for CodeBreaker Hackathon 2026.
