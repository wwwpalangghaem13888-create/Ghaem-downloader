# Ghaem Downloader

A self-hosted Telegram media downloader with a Persian RTL web administration dashboard.

## MVP 0.2.0 features

- Telegram bot: /start, /help, public URL submission, /status and /cancel.
- FastAPI admin API guarded by X-Admin-API-Key.
- PostgreSQL task persistence and Redis-backed queue.
- yt-dlp single-worker execution with size cap, cancellation checks and retry settings.
- Persian RTL Next.js dashboard with status cards, live task refresh, URL submission, task cancellation and protected file retrieval.
- Docker Compose services for API, worker, bot, dashboard, PostgreSQL and Redis.
- Downloaded files are cleaned after 24 hours.

## Run

1. Install Docker Engine and Docker Compose.
2. Copy .env.example to .env.
3. Set separate strong random values for SECRET_KEY, ADMIN_API_KEY and DASHBOARD_ACCESS_TOKEN. For ease of DATABASE_URL parsing, use a 32-character hexadecimal POSTGRES_PASSWORD and put the same password in DATABASE_URL.
4. Any Telegram bot token previously pasted into a chat must be revoked. Generate a new one with BotFather and set BOT_TOKEN in .env.
5. Run: docker compose up --build -d
6. Dashboard: http://127.0.0.1:3000
7. API health: http://127.0.0.1:8000/health
8. Enter DASHBOARD_ACCESS_TOKEN in the dashboard. In Telegram, open the bot and send /start.

When BOT_TOKEN is empty, the bot container idles and the dashboard/API can still run. Dashboard and API ports bind to localhost.

## Supported platforms

Initial allowlist: YouTube, Instagram, TikTok, X/Twitter, Facebook, Pinterest, Reddit and SoundCloud. Extraction depends on each website's public access rules and current yt-dlp extractor support. Private, paywalled, DRM-protected or login-restricted media is intentionally unsupported. Follow copyright and platform terms.

## API routes

- GET /api/v1/tasks
- POST /api/v1/tasks with JSON body containing source_url
- GET /api/v1/tasks/{id}
- DELETE /api/v1/tasks/{id}
- GET /api/v1/tasks/{id}/file

## Security and remaining production work

- URL allowlisting and preflight DNS checks are defense-in-depth, not a complete SSRF boundary. yt-dlp follows redirects and contacts CDN hosts. Production requires a dedicated egress proxy/network policy that blocks private, loopback, link-local and cloud metadata IPs at connection time, with DNS-rebinding protection.
- The processing-list recovery logic assumes one worker replica. Do not horizontally scale workers until leases, visibility timeouts and idempotent recovery are implemented.
- Telegram file delivery is capped at 45 MB. Larger files can be retrieved from the protected dashboard while retained.
- Dashboard authentication is a shared access token, not per-user identity, SSO or granular RBAC. Deploy behind HTTPS and a trusted reverse proxy; do not expose it directly to the public internet.
- Database tables are auto-created for this MVP. Add Alembic migrations, backups, monitoring, audit logging, quotas and a security review before production.
- No DRM, private-content or authentication/paywall bypass is provided.

The implementation is on branch setup/initial-scaffold and has not been merged into main.
