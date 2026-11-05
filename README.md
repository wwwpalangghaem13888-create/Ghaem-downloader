# Ghaem Downloader — Cloudflare Free Architecture

A zero-paid-service Telegram request manager and static admin dashboard built for Cloudflare Workers Free.

> **Honest capability status:** this release does not download media. Cloudflare Workers Free cannot run yt-dlp or FFmpeg, and no compliant, tested Workers-native provider adapter is currently available. Requests are validated, stored and classified; the queue marks unsupported providers honestly. No fake download URLs or files are generated.

## Free-tier compatibility

Read [the detailed compatibility matrix](cloudflare/COMPATIBILITY.md) before deploying. The project targets Workers Free, D1, R2 Standard free allowance, Queues free allowance, Workers Static Assets and GitHub. It never silently upgrades to a paid service.

Key published free limits checked on 2026-11-06:
- Workers: 100,000 requests/day and 10 ms CPU per invocation.
- D1: 5 million rows read/day, 100,000 rows written/day, 5 GB total storage.
- R2 Standard: 10 GB-month, 1 million Class A operations/month, 10 million Class B operations/month.
- Queues: 10,000 operations/day and 24-hour message retention.
- Static assets: up to 20,000 files/version and 25 MiB/file.

Limits may change. See official links in the matrix.

## Architecture

- **Worker API:** TypeScript module Worker, short-lived event-driven handlers.
- **Telegram:** webhook endpoint with Telegram's webhook secret header; no long polling.
- **D1:** users, tasks, per-user daily quotas and audit events.
- **Queues:** asynchronous task classification; queue payloads contain task IDs only.
- **R2:** binding reserved for short-lived outputs; no media processing currently writes objects.
- **Dashboard:** static Persian RTL HTML/JS served through Workers Static Assets.
- **Cron:** bounded expiration cleanup.
- **Providers:** modular registry exposes capabilities and explicitly marks all current media extraction adapters unsupported.

## Local development

Requirements: Node.js 22 and npm. These are development tools, not paid runtime services.

```bash
npm install
npm run typecheck
npm run dev
```

Create Cloudflare resources from the Free account:
1. Create a D1 database named `ghaem-downloader`.
2. Create an R2 Standard bucket named `ghaem-downloader-temp`.
3. Create a queue named `ghaem-download-tasks` and a dead-letter queue named `ghaem-download-dlq`.
4. Replace the D1 database ID placeholder in `wrangler.jsonc` with the actual ID.
5. Apply migrations: `npm run db:remote`.
6. Add encrypted secrets with Wrangler:
   - `npx wrangler secret put TELEGRAM_BOT_TOKEN`
   - `npx wrangler secret put TELEGRAM_WEBHOOK_SECRET`
   - `npx wrangler secret put ADMIN_API_TOKEN`
7. Deploy: `npm run deploy`.
8. Set the Telegram webhook to `https://YOUR-WORKER.workers.dev/telegram/webhook` using the Telegram Bot API and the same webhook secret configured above.

Never commit secrets, paste bot tokens into source code, or use a token previously exposed in a chat. Rotate any exposed token.

## Zero-cost deployment guardrails

- Keep the Cloudflare account and Worker on the **Free** plan.
- Do not enable Workers Paid, Containers, paid add-ons, or external paid services.
- Do not add a payment card as a deployment requirement. If Cloudflare requires a payment method for your account or a product, stop and report that blocker.
- Use only R2 Standard and stay below the published free allowance. The application must reject new storage work before reaching the configured local caps.
- When D1 or Queues free limits are reached, surface the error and pause task intake; do not upgrade or retry indefinitely.
- Review Cloudflare usage dashboards regularly. The app-level caps are conservative safeguards, not a substitute for provider-side usage monitoring.

## API

- `GET /health` — runtime health and capability status.
- `POST /telegram/webhook` — Telegram webhook; requires Telegram's secret-token header.
- `GET /api/tasks` — recent tasks; requires `Authorization: Bearer ADMIN_API_TOKEN`.
- `POST /api/tasks` — admin task creation; requires source_url, telegram_user_id and telegram_chat_id.
- `GET /api/tasks/:id` — task detail; requires admin token.

## Media support matrix

YouTube, Instagram, TikTok, X, Facebook, Pinterest, Reddit and SoundCloud are recognized as provider labels only. Actual extraction, transcoding, merging, thumbnail generation and large file delivery are **unsupported**. Do not add scraping, DRM bypass, login/paywall bypass, or an external paid downloader.

## Security and known limitations

- Only HTTPS/HTTP URLs on the configured domain allowlist are accepted. The Worker does not fetch the supplied media URL.
- URL allowlisting is not a general SSRF-safe fetch proxy; do not add outbound media fetching without a separately reviewed network design.
- The initial admin model is a single encrypted bearer secret, not multi-user RBAC.
- Telegram webhook update idempotency and comprehensive quota telemetry remain follow-up hardening tasks.
- The static dashboard keeps the admin token in page memory only; it does not persist it to local storage.
- R2 object writes are intentionally disabled until a real supported media feature and byte/object quota accounting are implemented.

## Status

This is a Cloudflare migration branch, not merged to main. Deployment has not been performed in the user's Cloudflare account; resource creation, secret setup, webhook registration and no-card account eligibility still require verification there.
