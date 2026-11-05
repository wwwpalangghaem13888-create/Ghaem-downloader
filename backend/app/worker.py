import asyncio
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Event
from aiogram import Bot
from redis.asyncio import from_url
from sqlalchemy import select
from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError
from app.core.config import get_settings
from app.database import DownloadTask, SessionLocal, close_database, initialize_database
from app.tasks import QUEUE_KEY

settings = get_settings()
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("ghaem.worker")
PROCESSING = "ghaem:downloads:processing"

def download_media(url: str, task_id: str, cancel: Event):
    root = Path(settings.download_dir)
    root.mkdir(parents=True, exist_ok=True)
    def progress(_status):
        if cancel.is_set():
            raise DownloadError("Download cancelled")
    options = {
        "outtmpl": str(root / (task_id + ".%(ext)s")),
        "format": "best[ext=mp4]/best",
        "noplaylist": True, "quiet": True, "no_warnings": True,
        "socket_timeout": 20, "retries": 2, "fragment_retries": 2,
        "max_filesize": settings.max_download_mb * 1024 * 1024,
        "progress_hooks": [progress],
    }
    with YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=True)
        candidates = [info.get("_filename", "")]
        candidates += [item.get("filepath", "") for item in info.get("requested_downloads", [])]
        candidates += [str(ydl.prepare_filename(info))]
    for candidate in candidates:
        if not candidate:
            continue
        path = Path(candidate).resolve()
        if root.resolve() in path.parents and path.is_file():
            return info.get("title", "Downloaded media")[:512], str(path)
    raise DownloadError("Expected downloaded file was not found")

async def notify(bot, chat_id, text):
    if bot and chat_id:
        try:
            await bot.send_message(chat_id, text)
        except Exception:
            log.exception("Telegram notification failed")

async def run_task(task_id, redis, bot):
    async with SessionLocal() as db:
        task = await db.get(DownloadTask, task_id)
        if task is None or task.status in {"cancelled", "completed"}:
            return
        task.status = "downloading"
        await db.commit()
        url, chat_id = task.source_url, task.telegram_chat_id
    cancel = Event()
    async def watcher():
        key = "ghaem:downloads:cancel:" + task_id
        while not cancel.is_set():
            if await redis.exists(key):
                cancel.set()
                break
            await asyncio.sleep(1)
    watch = asyncio.create_task(watcher())
    try:
        title, filename = await asyncio.to_thread(download_media, url, task_id, cancel)
        async with SessionLocal() as db:
            task = await db.get(DownloadTask, task_id)
            if task:
                task.status, task.title, task.file_path = "completed", title, filename
                task.completed_at = datetime.now(timezone.utc)
                await db.commit()
        if bot and chat_id:
            size = Path(filename).stat().st_size
            if size <= settings.telegram_upload_limit_mb * 1024 * 1024:
                from aiogram.types import FSInputFile
                try:
                    await bot.send_document(chat_id, FSInputFile(filename), caption=title[:900])
                except Exception:
                    log.exception("Telegram upload failed; file remains on dashboard")
                    await notify(bot, chat_id, "دانلود انجام شد؛ دریافت فایل از پنل مدیریت امکان‌پذیر است.")
            else:
                await notify(bot, chat_id, "فایل بزرگ‌تر از سقف ارسال تلگرام است؛ آن را از پنل مدیریت دریافت کن.")
    except Exception as exc:
        cancelled = cancel.is_set() or "cancel" in str(exc).lower()
        async with SessionLocal() as db:
            task = await db.get(DownloadTask, task_id)
            if task:
                task.status = "cancelled" if cancelled else "failed"
                task.error = "Cancelled by requester" if cancelled else str(exc)[:1000]
                await db.commit()
        await notify(bot, chat_id, "دانلود لغو شد." if cancelled else "دانلود ناموفق بود؛ لینک یا محدودیت‌های سایت را بررسی کن.")
        if not cancelled:
            log.exception("Task %s failed", task_id)
    finally:
        watch.cancel()
        try:
            await watch
        except asyncio.CancelledError:
            pass
        await redis.delete("ghaem:downloads:cancel:" + task_id)

async def cleanup():
    cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.completed_file_retention_hours)
    async with SessionLocal() as db:
        result = await db.scalars(select(DownloadTask).where(
            DownloadTask.status == "completed",
            DownloadTask.completed_at < cutoff,
            DownloadTask.file_path.is_not(None)))
        for task in result.all():
            Path(task.file_path).unlink(missing_ok=True)
            task.file_path = None
        await db.commit()

async def main():
    await initialize_database()
    redis = from_url(settings.redis_url, decode_responses=True)
    bot = Bot(settings.bot_token) if settings.bot_token else None
    # Recovery is designed for one worker replica only.
    while True:
        old = await redis.lpop(PROCESSING)
        if old is None:
            break
        await redis.rpush(QUEUE_KEY, old)
    last_cleanup = 0
    try:
        while True:
            if asyncio.get_running_loop().time() - last_cleanup > 3600:
                await cleanup()
                last_cleanup = asyncio.get_running_loop().time()
            task_id = await redis.brpoplpush(QUEUE_KEY, PROCESSING, timeout=5)
            if task_id:
                try:
                    await run_task(task_id, redis, bot)
                finally:
                    await redis.lrem(PROCESSING, 1, task_id)
    finally:
        if bot:
            await bot.session.close()
        await redis.aclose()
        await close_database()

if __name__ == "__main__":
    asyncio.run(main())
