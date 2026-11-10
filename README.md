# Eventure

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-000000.svg)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg)](https://vitejs.dev/)
[![Sarvam AI](https://img.shields.io/badge/Sarvam%20AI-105B%20Indic-blueviolet.svg)](https://sarvam.ai)
[![Tests](https://img.shields.io/badge/Tests-110%20Passing-success.svg)](#3-check-it-works)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Every event, one thread.** The unified timeline and decision engine for college hackathons, competitions, and campus events.

Built by **Team Quanta** for **hackFront India Grand Finale (IIIT Delhi, 21–22 Nov 2026)**:
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
  A["Poster / Notice / WhatsApp Circular"] --> B["Sarvam AI (sarvam-105b) + OCR"]
  B --> C["Student Confirmation"]
  C --> D[("Relational DB (SQLite / PostgreSQL)")]
  D --> E["Deterministic Clash & Commute Engine"]
  D --> F["Keep-or-Skip Priority Scoring (0-100)"]
  D --> G["Verified Reviews & Discover Map"]
  E --> H["React 18 Frontend (Dual-Theme)"]
  F --> H
  G --> H
  H --> K["Sarvam Translate (Indic Multilingual UI)"]
  D --> I["Escalating Push & In-App Alerts"]
  D --> J["Google Calendar & Private .ics Feed"]
```

**Tech Stack:**
- **Frontend:** React 18, Vite 5, Vitest, Leaflet interactive mapping with CartoDB tiles, Web Push, installable PWA, Dual-Theme (Carbon Slate & Clean Slate).
- **Backend:** Python Flask 3, SQLAlchemy ORM (15 relational tables), PyJWT stateless auth (RFC 7518 compliant), APScheduler.
- **AI & Indic Language:** Sarvam AI (`sarvam-105b` MoE chat model for Hinglish notice extraction, `Sarvam Translate` for Indic languages: Hindi, Bengali, Tamil), with 100% zero-crash deterministic fallback.
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

#### Backend Test Suite (92 tests):

```powershell
cd backend
python -m unittest discover -s tests -v
# or using pytest:
pytest tests -v
```

**92 automated tests** run across:
- Conflict detection (direct overlaps, commute travel gaps, exam periods, personal calendars)
- Algorithmic priority scoring and keep-or-skip recommendations
- User-configurable tracked portals CRUD, sync watcher, and platform affinity ranking boost
- OCR preprocessing pipeline (greyscale, adaptive upscaling, binarization) and error recovery
- Security rate limiting, RFC 7518 JWT validation, and live API endpoints

#### Frontend Test Suite (18 tests):

```powershell
cd frontend
npm test
```

**18 automated tests** run via Vitest across:
- Date & range formatting (same-day, multi-day, fallback handling)
- Relative time & deadline calculations (`timeLeft`, `timeAgo`)
- Travel duration formatting and sanity caps
- API client authentication flow, token storage, 401 auto-logout, and file uploads

---

## Core Capabilities

| Feature | Description |
|---|---|
| **Sarvam AI Extraction** | `sarvam-105b` extracts multi-stage milestones, venues, and deadlines from Hinglish circulars & posters. |
| **Indic Multilingual UI** | Powered by `Sarvam Translate` across English, Hindi, Bengali, and Tamil for campus accessibility. |
| **Submission Vault** | Dedicated toolkit storing live demo URL, GitHub repo, slides, video link, 1-click `Copy All Links`, pre-submission checklist, and venue Wi-Fi/table info. |
| **Direct Portal Navigation** | 1-click button to open official hackathon page directly from timeline, inbox, and event cards, plus inline link editor. |
| **Tracked Portals Watcher** | User-defined portal tracker (Unstop, Devfolio, Hack2skill, custom `xyz.com`) with automated deadline sync and ranking affinity boost (+15). |
| **Stage Timeline** | Multi-round checklists (abstract, prototype, presentation) with color-coded deadline alerts. |
| **Clash Radar** | Detects overlapping events, exam conflicts, and tight commute gaps (travel time + 15 min buffer). |
| **Keep-or-Skip Engine** | Evaluates goal fit, deadline urgency, travel ease, and exam penalties to advise which plan to keep. |
| **Smart Ingestion** | Upload flyers (OCR), paste notices, or forward emails to your private campus inbox token. |
| **Discover Map** | Interactive Leaflet campus map showing nearby hackathons with Bayesian-smoothed ratings and "My Portals" filter. |
| **Verified Reviews** | Anti-tamper review system accepting ratings only from students confirmed to have attended. |
| **Escalating Alerts** | Background scheduler dispatching warnings at 48h, 24h, and 6h prior to stage deadlines. |
| **Calendar Sync** | Two-way Google Calendar push and a private `.ics` feed for Apple Calendar, Outlook, and mobile widgets. |

---

## Optional Integrations

- **Sarvam AI API:** Set `SARVAM_API_KEY` in `backend/.env` to enable `sarvam-105b` extraction and `Sarvam Translate` Indic translation.
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
│   │   ├── models.py             # 16 SQLAlchemy tables (including TrackedPortal)
│   │   ├── routes/               # Modular REST endpoints (auth, timeline, discover, portals, etc.)
│   │   ├── services/             # Business logic (sarvam_ai, conflicts, travel, priority, ocr)
│   │   └── utils.py              # Centralized shared helpers (formatting, dates, sanitization)
│   ├── tests/                    # 92 unit and integration tests (pytest / unittest)
│   ├── seed.py                   # Realistic multi-campus seed data
│   └── run.py                    # Application entrypoint
├── frontend/
│   ├── src/
│   │   ├── pages/                # Timeline, Discover, AddEvent, Settings, Login, NotFound, etc.
│   │   ├── components/           # IssueCard, MapView, EventForm, HackathonVault
│   │   ├── api.test.js           # API client integration tests
│   │   ├── utils.test.js         # Frontend utility test suite
│   │   ├── utils.js              # Centralized UI utility functions
│   │   └── styles.css            # Clean Slate (Light) & Carbon Slate (Dark) design system
│   └── package.json              # React 18, Vite 5, Vitest, Leaflet dependencies
├── Dockerfile                    # Container definition
├── docker-compose.yml            # Multi-service setup (App + PostgreSQL)
└── README.md                     # Documentation

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details. Built with pride by Team Quanta for hackFront India 2026.
