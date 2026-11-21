# Eventure Deployment Environment Setup

This document details the environment configuration for deploying **Eventure** to **Render** (Backend) and **Vercel** (Frontend).

---

## 1. Architecture Overview

- **Backend Web Service**: Render (`https://eventure-gdx5.onrender.com`)
- **Frontend SPA**: Vercel (`https://*.vercel.app` or custom domain)
- **Vercel API Proxy**: Configured via `frontend/vercel.json` to proxy `/api/*` and `/auth/*` directly to `https://eventure-gdx5.onrender.com`.

---

## 2. Render Environment Variables (Backend)

In your **Render Dashboard** -> **eventure-gdx5** -> **Environment**, add the following key-value pairs (your actual populated keys are saved locally in your uncommitted `backend/.env` and `backend/.env.production` files):

```bash
SECRET_KEY=eventure-production-super-secret-key-32-bytes-long!
CORS_ORIGINS=http://localhost:5173,https://eventure-gdx5.onrender.com,https://*.vercel.app,*
TRUST_PROXY=1
TIMEZONE=Asia/Kolkata
FRONTEND_URL=https://eventure-gdx5.onrender.com
APP_BASE_URL=https://eventure-gdx5.onrender.com

# Gemini LLM Architecture (Chatbot + Submission Box)
GEMINI_API_KEY=<PASTE_YOUR_GEMINI_API_KEY>
GEMINI_MODEL=gemini-2.5-flash

# Sarvam AI Indic Engine (Voice Calls, Hinglish extraction & TTS)
SARVAM_API_KEY=<PASTE_YOUR_SARVAM_API_KEY>
SARVAM_MODEL=sarvam-105b-conversations
SARVAM_TRANSLATE_MODEL=sarvam-translate:v1
SARVAM_TTS_MODEL=bulbul:v3

# OpenStreetMap Geocoding (100% Free - No Google Maps Key Needed)
GEOCODE_OSM=1
GOOGLE_MAPS_API_KEY=

# Hackathon Suggestions (Google Custom Search or Free Web Engine)
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_CX=

# Neo4j Graph Database
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=eventure-graph-pass

# Google Calendar sync / Google Sign-in
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://eventure-gdx5.onrender.com/api/google/callback

# Web Push Notification VAPID Keys (Copy from backend/.env)
VAPID_PUBLIC_KEY=BHWmvmgcfRafL9w56ZLAnxR7ZJG5AD6EGG9H0BAxOZwxQA20aniNzfa0A12D2zXAr8ye3zT22ZKAIiNqTKUHyWw
VAPID_PRIVATE_KEY=<COPY_FROM_BACKEND_DOT_ENV>
VAPID_SUBJECT=mailto:Raiaryaneng@gmail.com

# Inbound Webhooks & Email Processing
INBOX_ADDRESS=noil36l4m3cdsgo5@ethereal.email
IMAP_HOST=imap.ethereal.email
IMAP_PORT=993
IMAP_USER=noil36l4m3cdsgo5@ethereal.email
IMAP_PASSWORD=<COPY_FROM_BACKEND_DOT_ENV>
IMAP_POLL_MINUTES=5
INBOUND_SECRET=<COPY_FROM_BACKEND_DOT_ENV>

# Database Auto-creation & Reminder Background Scheduler
AUTO_CREATE_DB=1
ENABLE_SCHEDULER=1
REMINDER_INTERVAL_MINUTES=15

# SMTP Email Configuration (Free Ethereal Email test mailbox at https://ethereal.email)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=noil36l4m3cdsgo5@ethereal.email
SMTP_PASSWORD=<COPY_FROM_BACKEND_DOT_ENV>
SMTP_FROM=Raiaryaneng@gmail.com
```

---

## 3. Vercel Environment Variables (Frontend)

In your **Vercel Dashboard** -> Project -> **Settings** -> **Environment Variables**, add:

```bash
VITE_API_URL=https://eventure-gdx5.onrender.com/api
```

Also, `frontend/vercel.json` is preconfigured to rewrite `/api/(.*)` requests directly to `https://eventure-gdx5.onrender.com/api/$1` and handle client-side routing.
