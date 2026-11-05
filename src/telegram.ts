import type { Env } from "./types";
interface TelegramUpdate { message?: { chat: { id: number }; from?: { id: number }; text?: string } }
export async function telegramSend(env: Env, chatId: number, text: string): Promise<void> {
 const endpoint = new URL("https://api.telegram.org/");
 endpoint.pathname = "/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage";
 const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }) });
 if (!response.ok) throw new Error("TELEGRAM_SEND_FAILED");
}
export async function handleTelegramUpdate(update: TelegramUpdate, env: Env): Promise<void> {
 const message = update.message; if (!message?.text || !message.from) return;
 const chatId = message.chat.id; const userId = String(message.from.id); const text = message.text.trim();
 await env.DB.prepare("INSERT INTO users(id,telegram_user_id,telegram_chat_id) VALUES(?,?,?) ON CONFLICT(telegram_user_id) DO UPDATE SET telegram_chat_id=excluded.telegram_chat_id,last_seen_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(crypto.randomUUID(),userId,String(chatId)).run();
 if (text === "/start" || text === "/help") { await telegramSend(env,chatId,"این نسخه درخواست‌ها را مدیریت می‌کند؛ دانلود واقعی رسانه فعلاً پشتیبانی نمی‌شود. لینک عمومی از دامنه مجاز بفرست."); return; }
 if (!/^https?:\/\//i.test(text)) { await telegramSend(env,chatId,"یک لینک عمومی معتبر بفرست یا /help را ارسال کن."); return; }
 const { createTask } = await import("./tasks"); const result = await createTask(env,userId,text);
 await telegramSend(env,chatId,result.ok ? "درخواست " + result.taskId.slice(0,8) + " ثبت شد؛ استخراج رسانه فعلاً پشتیبانی نمی‌شود." : result.message);
}