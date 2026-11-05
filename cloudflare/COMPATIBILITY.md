# Free-tier compatibility matrix

**Policy:** no paid Cloudflare plan, paid add-on, external paid compute, or paid API. A free-tier limit is a hard stop, not a reason to upgrade. Quotas can change; re-check official pricing before deployment.

Last checked: 2026-11-06.

| Capability | Free allowance / constraint | Decision |
|---|---|---|
| Workers API + Telegram webhook | 100,000 requests/day; 10 ms CPU/invocation; 128 MB memory; 50 subrequests/request | **Supported.** Short handlers, validate, persist, enqueue, return. |
| Static dashboard | Up to 20,000 asset files/version; 25 MiB/file; Worker limits still apply to dynamic routes | **Supported.** Static HTML/JS/CSS only; no Next.js server runtime. |
| D1 relational data | 5 million rows read/day; 100,000 rows written/day; 5 GB total storage | **Supported.** Indexed tables, bounded queries and retention cleanup. Limits cause operations to fail, not unlimited free usage. |
| R2 Standard objects | 10 GB-month; 1 million Class A ops/month; 10 million Class B ops/month; egress free | **Conditional.** Temporary small files only, hard application caps and aggressive cleanup. Never assume storage above quota is free. |
| Queues | 10,000 operations/day; 24-hour message retention; 128 KB/message | **Supported.** IDs/metadata only, never media bytes; low retry count. |
| Cron cleanup | Up to 5 Cron Triggers/account; 10 ms CPU/invocation | **Supported.** Small idempotent batches. |
| Encrypted secrets | Runtime secret bindings; do not commit tokens or .env files | **Supported.** Use wrangler secret put; fail closed if missing. |
| GitHub | Source control and docs; CI optional | **Supported.** Runtime must not depend on Actions. |
| YouTube, Instagram, TikTok, X, Facebook, Pinterest, Reddit, SoundCloud extraction | Workers Free cannot run arbitrary native binaries; no yt-dlp/FFmpeg; 10 ms CPU | **Unsupported** until a legal, tested, Workers-native free provider API exists. |
| Transcoding, merging, thumbnails | No FFmpeg/native binary execution; tiny CPU budget | **Unsupported.** |
| Large media transfer / Telegram file upload | R2 only 10 GB-month; streaming and platform constraints | **Unsupported as a general feature.** |
| User accounts / RBAC | Possible within D1/Workers quotas | **Partial.** MVP uses Telegram identity and one admin secret; full RBAC later. |
| Analytics | Workers Logs free allowance 200,000 events/day, 3-day retention; D1 quotas | **Basic only.** Counters and sampled logs. |

## Hard zero-cost controls

1. Keep account and Worker on **Workers Free**. Never switch to paid usage.
2. Do not create Workers Paid resources, Containers, paid Durable Object plans, paid add-ons, or external compute.
3. Do not require a payment card. If Cloudflare requires one for this account/product/region, stop and report the blocker; do not switch providers silently.
4. Reject new work at conservative app-level quotas with clear 429/503 responses.
5. R2 is the main financial risk: cap object count and bytes, delete aggressively, and inspect usage. The free allowance is not unlimited.
6. D1 and Queues failures at free limits must be surfaced; do not retry forever.
7. Telegram webhook only validates, stores metadata and enqueues. It does not fetch media.
8. Cleanup is idempotent and bounded. No unbounded object growth.
9. Queue messages contain task IDs only, never media bytes.
10. Deploy with Wrangler on the free plan. No billing upgrade path.

## Supported MVP behavior

- Verify Telegram webhook secret; support /start and /help.
- Accept public URLs from an allowlist, create a task and enqueue classification.
- Truthfully mark tasks unsupported when no compliant Workers-native media provider exists.
- Static dashboard, protected admin API, D1 quota counters and bounded cleanup.
- R2 binding is prepared for temporary objects, but media processing stays disabled.

## Official references

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/queues/platform/pricing/
- https://developers.cloudflare.com/queues/platform/limits/
- https://developers.cloudflare.com/pages/platform/limits/
