# Contributing to Eventure

**Repository:** [github.com/manavsetia008/Eventure](https://github.com/manavsetia008/Eventure)

Thanks for helping. The short version:

1. Fork, then create a branch from `main`.
2. Run the backend tests before you push: `cd backend && python -m unittest discover -s tests -v` (92 passing tests).
3. Run `cd frontend && npm test` (18 passing tests) and `npm run build` to check the app still compiles.
4. Open a pull request that says what changed and why. Small, focused pull requests get reviewed fastest.

Guidelines
- Keep the clash, priority and extraction logic in `backend/app/services` as plain deterministic functions with tests in `backend/tests`.
- New API routes get an automated test in `backend/tests/test_api.py`.
- Error messages are written for students: say what went wrong and what to do next.
- Never commit `.env`, SQLite/PostgreSQL database files, or private API keys.

Security issues: please do not open a public issue. Contact the maintainers directly.
