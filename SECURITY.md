# Security Policy

## Supported versions

GamePulse is pre-`1.0`; security fixes land on the `main` branch. Please run a
recent `main` before reporting.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately via GitHub Security Advisories:
<https://github.com/devoidinity/GamePulse/security/advisories/new>

Please include:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- affected component (api / worker / dashboard / sdk / shared) and version/commit.

We aim to acknowledge reports within a few days and will coordinate a fix and
disclosure timeline with you.

## Hardening reminders for self-hosters

- Replace the example `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` with strong,
  distinct values (`openssl rand -hex 48`). The API refuses to boot in
  production with the defaults.
- Restrict `CORS_ORIGIN` to your dashboard origin(s).
- Terminate TLS at a reverse proxy in front of the API and dashboard.
- Rotate project API keys if you suspect exposure (`POST /projects/:id/rotate-key`).
