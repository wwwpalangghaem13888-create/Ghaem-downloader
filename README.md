# Ghaem Downloader

A modular Telegram media downloader and web administration platform.

> **Development status:** foundation only. Authentication, database migrations, job processing, bot handlers, dashboard, and production deployment are not implemented yet.

## Stack
- FastAPI / Python 3.12
- aiogram 3 (dependency included; bot runtime integration is pending)
- PostgreSQL and Redis (Compose services)
- yt-dlp (dependency included; downloader service is pending)
- Next.js + TypeScript dashboard (planned)

## Repository layout
```
backend/
  app/core/       typed configuration
  app/security/   URL validation helper
  app/api/        API package
  app/main.py     FastAPI application
  tests/          unit tests
docker-compose.yml
.env.example
```

## Run locally
1. Install Docker Engine and Docker Compose.
2. Copy `.env.example` to `.env`.
3. Replace `SECRET_KEY` and `POSTGRES_PASSWORD` with unique random values.
4. Run `docker compose up --build`.
5. Check `http://localhost:8000/health` and `http://localhost:8000/ready`.
6. Development API docs are at `http://localhost:8000/docs`.

The API binds to localhost by default. Do not expose it publicly before authentication and reverse-proxy hardening.

## Security
- URL allowlisting and DNS checks are defense-in-depth, not a complete SSRF boundary. Production download workers need network egress restrictions blocking private, loopback, link-local, multicast, and cloud metadata ranges, plus DNS-rebinding protections.
- Do not download private, paywalled, DRM-protected, or authentication-restricted content.
- Add authentication, RBAC, quotas, size/time limits, and temporary-file cleanup before enabling downloads.
- Never commit credentials. Revoke any bot token previously exposed in chat or source control.

## Roadmap
- [x] Initial repository hygiene
- [x] FastAPI skeleton and typed configuration
- [x] URL validation helper and initial tests
- [x] Docker Compose foundation
- [ ] Database models and Alembic migrations
- [ ] Authentication, sessions, RBAC, and audit events
- [ ] Redis-backed job queue and workers
- [ ] Telegram bot commands and Persian/English localization
- [ ] Downloader adapters, progress, cancellation, and cleanup
- [ ] Next.js dashboard and RTL design system
- [ ] Analytics, monitoring, backups, and production hardening
- [ ] Integration and end-to-end tests

No license has been selected yet.
