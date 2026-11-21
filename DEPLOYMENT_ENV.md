# Eventure — Production Deployment

Eventure uses the Flask API with a React/Vite frontend. The recommended deployment is Vercel
(frontend) + Render (backend) + Supabase Postgres (database).

## Security note

The repository previously contained a fixed example signing key and an unrestricted CORS example.
Treat any key ever used with that value as compromised and rotate it. Do not commit populated
credentials, database passwords, OAuth secrets, VAPID private keys, or mail passwords.

## Render — backend

Use the Dockerfile at the repository root. Set the following values in the Render service's
Environment page:

```bash
APP_ENV=production
SECRET_KEY=<generate-a-unique-random-secret-at-least-32-characters>
DATABASE_URL=<supabase-transaction-pooler-uri-with-sslmode=require>
CORS_ORIGINS=<your-vercel-production-domain>
TRUST_PROXY=1
TIMEZONE=Asia/Kolkata
FRONTEND_URL=<your-vercel-production-domain>
APP_BASE_URL=<your-vercel-production-domain>
AUTO_CREATE_DB=1
ENABLE_SCHEDULER=1
GEOCODE_OSM=1
```

For Supabase, use the **Shared Session pooler** for this persistent Flask/Gunicorn service.
Include `sslmode=require`. The project is in Mumbai (`ap-south-1`), and the dedicated app role
is `eventure_app`. Keep credentials only in Render's encrypted environment variables; never put
the database password, `SECRET_KEY`, or a service-role key in frontend variables.

The initial credentials are held in the project's private `eventure_private.provisioning_secret`
schema, which is not exposed through the Data API and denies access to `anon`, `authenticated`,
and the app role. To retrieve them yourself, open the Supabase SQL Editor and run:

```sql
SELECT db_password, app_secret
FROM eventure_private.provisioning_secret
WHERE id = true;
```

Set the returned `app_secret` as Render's `SECRET_KEY`. Set `DATABASE_URL` to the following
template, replacing only `<db_password>` with the returned value:

```text
postgresql://eventure_app.hgtojfxftzsaekukdpzf:<db_password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require
```

Do not paste either returned value into chat or commit them to Git. After the Render service is
healthy, the private provisioning schema can be removed.

Eventure connects to Postgres from the Flask server using SQLAlchemy; the browser talks only to
the Flask API with Eventure JWTs. No Supabase browser key or `supabase-js` client is required.
At startup, Eventure enables Row Level Security on its application tables when the database is
Postgres. Do not add public/anon table policies unless you intentionally introduce a separate
client-side data access design.

Optional integrations (only add when you have configured the provider):

- `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash` — AI assistant and enhanced event parsing.
- `SARVAM_API_KEY`, `SARVAM_MODEL`, `SARVAM_TRANSLATE_MODEL`, `SARVAM_TTS_MODEL` — Indic extraction,
  translation, and speech. The service has provider-specific free credits/limits.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — Google sign-in and Calendar.
  Set the callback URL to `<your-public-domain>/api/google/callback` for Calendar and
  `<your-public-domain>/auth/google/callback` for Google sign-in.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — browser push notifications. Generate
  a fresh keypair with `python scripts/generate_vapid_keys.py`.
- `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASSWORD`, `INBOUND_SECRET` — inbound email parsing.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` — outgoing email alerts.

The OpenStreetMap geocoder and Haversine distance fallback work without a Google Maps API key.
Do not enable aggressive geocoding or tile scraping; respect the public OSM service usage policy.

Set Render's health check path to `/api/health`. It verifies the database connection, not just
that the web process is alive.

## Vercel — frontend

Set the project root to `frontend`, framework to Vite, build command to `npm run build`, and
output directory to `dist`. The SPA uses a same-origin `/api/*` rewrite to the Render backend,
so `VITE_API_URL` can remain unset. If you choose to call the backend directly instead, set
`VITE_API_URL` to the backend's `/api` URL and allow the Vercel domain in `CORS_ORIGINS`.

Set these Google OAuth authorized JavaScript origins and redirect URIs to the deployed public
domain, plus localhost values for local development. Keep the Google client secret on Render only.

## Local development

Copy `backend/.env.example` to `backend/.env`, use `APP_ENV=development`, and leave
`DATABASE_URL` blank to use SQLite. Never copy local secrets into Git.
