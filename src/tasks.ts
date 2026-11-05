import type { Env } from "./types";
import { validateMediaUrl } from "./security";

type CreateTaskResult =
  | { ok: true; taskId: string; provider: string }
  | { ok: false; message: string };

function positiveLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export async function createTask(
  env: Env,
  telegramUserId: string,
  sourceUrl: string
): Promise<CreateTaskResult> {
  let validated: ReturnType<typeof validateMediaUrl>;
  try {
    validated = validateMediaUrl(sourceUrl, env);
  } catch {
    return { ok: false, message: "لینک معتبر یا دامنهٔ مجاز نیست." };
  }

  const user = await env.DB.prepare(
    "SELECT id FROM users WHERE telegram_user_id = ?"
  )
    .bind(telegramUserId)
    .first<{ id: string }>();

  if (!user) {
    return { ok: false, message: "ابتدا /start را ارسال کن." };
  }

  const dailyLimit = positiveLimit(env.MAX_TASKS_PER_TELEGRAM_USER_PER_DAY, 10);
  const pendingLimit = positiveLimit(env.MAX_PENDING_TASKS_PER_USER, 3);
  const today = new Date().toISOString().slice(0, 10);

  const usage = await env.DB.prepare(
    "SELECT tasks_created FROM daily_usage WHERE usage_date = ? AND user_id = ?"
  )
    .bind(today, user.id)
    .first<{ tasks_created: number }>();

  if ((usage?.tasks_created ?? 0) >= dailyLimit) {
    return { ok: false, message: "سهمیهٔ روزانهٔ ثبت درخواست تمام شده است." };
  }

  const pending = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM tasks WHERE user_id = ? AND status IN ('queued','processing')"
  )
    .bind(user.id)
    .first<{ count: number }>();

  if ((pending?.count ?? 0) >= pendingLimit) {
    return { ok: false, message: "تعداد درخواست‌های در انتظار به سقف مجاز رسیده است." };
  }

  const taskId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    "INSERT INTO tasks (id, user_id, source_url, provider, status, expires_at) VALUES (?, ?, ?, ?, 'queued', ?)"
  )
    .bind(taskId, user.id, validated.url.toString(), validated.provider.id, expiresAt)
    .run();

  await env.DB.prepare(
    "INSERT INTO daily_usage (usage_date, user_id, tasks_created) VALUES (?, ?, 1) ON CONFLICT(usage_date, user_id) DO UPDATE SET tasks_created = tasks_created + 1"
  )
    .bind(today, user.id)
    .run();

  try {
    await env.TASK_QUEUE.send({ taskId });
  } catch {
    await env.DB.prepare(
      "UPDATE tasks SET status = 'failed', error_code = 'QUEUE_UNAVAILABLE', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
    )
      .bind(taskId)
      .run();
    return { ok: false, message: "صف پردازش در دسترس نیست؛ کمی بعد دوباره تلاش کن." };
  }

  return { ok: true, taskId, provider: validated.provider.id };
}
