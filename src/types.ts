export interface Env {
 DB: D1Database; MEDIA: R2Bucket; TASK_QUEUE: Queue<{taskId:string}>; ASSETS: Fetcher;
 TELEGRAM_BOT_TOKEN: string; TELEGRAM_WEBHOOK_SECRET: string; ADMIN_API_TOKEN: string;
 APP_ENV: string; MAX_TASKS_PER_TELEGRAM_USER_PER_DAY: string; MAX_PENDING_TASKS_PER_USER: string;
 MAX_R2_BYTES: string; MAX_R2_OBJECTS: string; RETENTION_HOURS: string; ALLOWED_MEDIA_HOSTS: string;
}
export interface TaskMessage { taskId: string }
