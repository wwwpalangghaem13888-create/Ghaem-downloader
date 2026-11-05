from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import DownloadTask

QUEUE_KEY = "ghaem:downloads:queue"

async def enqueue_download(session: AsyncSession, redis, source_url: str,
                           telegram_user_id: int | None = None,
                           telegram_chat_id: int | None = None) -> DownloadTask:
    task = DownloadTask(id=str(uuid4()), source_url=source_url, status="queued",
                        telegram_user_id=telegram_user_id, telegram_chat_id=telegram_chat_id)
    session.add(task)
    await session.commit()
    await session.refresh(task)
    try:
        await redis.rpush(QUEUE_KEY, task.id)
    except Exception:
        task.status = "failed"
        task.error = "Queue service is unavailable"
        await session.commit()
        raise
    return task
