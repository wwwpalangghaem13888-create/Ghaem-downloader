import asyncio
import re
from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command
from aiogram.types import Message
from redis.asyncio import from_url
from sqlalchemy import desc, select
from app.core.config import get_settings
from app.database import DownloadTask, SessionLocal, initialize_database, close_database
from app.security.urls import validate_public_media_url
from app.tasks import enqueue_download

settings = get_settings()
URL_RE = re.compile(r"https?://[^\s<>]+")

async def main():
    if not settings.bot_token:
        raise RuntimeError("BOT_TOKEN is empty. Add a newly issued token to .env.")
    await initialize_database()
    redis = from_url(settings.redis_url, decode_responses=True)
    bot, dp = Bot(settings.bot_token), Dispatcher()

    @dp.message(Command("start"))
    async def start(message: Message):
        await message.answer("سلام! لینک عمومی ویدئو یا صدا را بفرست تا دانلود شود.\\nدستورها: /help ، /status و /cancel شناسه")

    @dp.message(Command("help"))
    async def help_text(message: Message):
        await message.answer("لینک عمومی از سایت‌های پشتیبانی‌شده بفرست. محتوای خصوصی، پولی، نیازمند ورود یا DRM پشتیبانی نمی‌شود.\\n/status وضعیت درخواست‌ها\\n/cancel شناسه لغو درخواست")

    @dp.message(Command("status"))
    async def status(message: Message):
        async with SessionLocal() as db:
            query = select(DownloadTask).where(DownloadTask.telegram_user_id == message.from_user.id).order_by(desc(DownloadTask.created_at)).limit(5)
            rows = list((await db.scalars(query)).all())
        await message.answer("هنوز درخواستی ثبت نکرده‌ای." if not rows else "آخرین درخواست‌ها:\\n" + "\\n".join(f"{row.id[:8]} | {row.status}" for row in rows))

    @dp.message(Command("cancel"))
    async def cancel(message: Message):
        args = (message.text or "").split(maxsplit=1)
        if len(args) != 2:
            await message.answer("شناسهٔ کامل تسک را وارد کن.")
            return
        async with SessionLocal() as db:
            task = await db.get(DownloadTask, args[1].strip())
            if task is None or task.telegram_user_id != message.from_user.id:
                await message.answer("تسک پیدا نشد.")
                return
            if task.status not in {"queued", "downloading"}:
                await message.answer("این تسک قابل لغو نیست.")
                return
            await redis.setex("ghaem:downloads:cancel:" + task.id, 3600, "1")
            if task.status == "queued":
                task.status = "cancelled"
                await db.commit()
        await message.answer("درخواست لغو ثبت شد.")

    @dp.message(F.text)
    async def receive(message: Message):
        match = URL_RE.search(message.text or "")
        if not match:
            await message.answer("یک لینک معتبر بفرست؛ برای راهنما /help را بزن.")
            return
        try:
            safe = await asyncio.to_thread(validate_public_media_url, match.group(0).rstrip(".,؛،)"), settings.allowed_hosts)
            async with SessionLocal() as db:
                task = await enqueue_download(db, redis, safe, message.from_user.id, message.chat.id)
        except Exception as exc:
            await message.answer(str(getattr(exc, "detail", "ثبت درخواست ناموفق بود.")))
            return
        await message.answer(f"درخواست ثبت شد.\\nشناسه: {task.id}\\nوضعیت: در صف")

    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()
        await redis.aclose()
        await close_database()

if __name__ == "__main__":
    asyncio.run(main())
