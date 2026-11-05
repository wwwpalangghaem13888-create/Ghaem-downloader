PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, telegram_user_id TEXT NOT NULL UNIQUE, telegram_chat_id TEXT NOT NULL,
 language TEXT NOT NULL DEFAULT 'fa' CHECK(language IN ('fa','en')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS tasks (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 source_url TEXT NOT NULL, provider TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('queued','processing','completed','failed','unsupported','cancelled')),
 result_key TEXT, error_code TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_created ON tasks(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status_created ON tasks(status,created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_expiry ON tasks(expires_at);
CREATE TABLE IF NOT EXISTS daily_usage (
 usage_date TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 tasks_created INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(usage_date,user_id)
);
CREATE TABLE IF NOT EXISTS audit_log (
 id TEXT PRIMARY KEY, actor_user_id TEXT, action TEXT NOT NULL, task_id TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);