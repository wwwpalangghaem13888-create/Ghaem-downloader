import asyncio
import secrets
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from redis.asyncio import from_url
from sqlalchemy import desc, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.database import DownloadTask, SessionLocal, close_database, engine, initialize_database
from app.security.urls import validate_public_media_url
from app.tasks import enqueue_download

settings = get_settings()

class TaskCreate(BaseModel):
    source_url: str = Field(min_length=8, max_length=2048)
    telegram_chat_id: int | None = None
    telegram_user_id: int | None = None

class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    source_url: str
    status: str
    telegram_user_id: int | None
    title: str | None
    error: str | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None

async def get_session():
    async with SessionLocal() as session:
        yield session

async def require_admin(x_admin_api_key: str | None = Header(default=None, alias="X-Admin-API-Key")):
    expected = settings.admin_api_key
    if not expected:
        raise HTTPException(status_code=503, detail="Admin API is not configured")
    if not x_admin_api_key or not secrets.compare_digest(x_admin_api_key, expected):
        raise HTTPException(status_code=401, detail="Invalid admin API key")

@asynccontextmanager
async def lifespan(application: FastAPI):
    await initialize_database()
    application.state.redis = from_url(settings.redis_url, decode_responses=True)
    yield
    await application.state.redis.aclose()
    await close_database()

app = FastAPI(title=settings.app_name, version="0.2.0", lifespan=lifespan,
              docs_url="/docs" if settings.app_env == "development" else None,
              redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=[], allow_credentials=False,
                   allow_methods=["GET", "POST", "DELETE"],
                   allow_headers=["Content-Type", "X-Admin-API-Key"])

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ghaem-downloader-api"}

@app.get("/ready")
async def ready():
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        await app.state.redis.ping()
    except Exception:
        raise HTTPException(status_code=503, detail="A required dependency is unavailable")
    return {"status": "ready", "dependencies": "postgresql+redis"}

@app.get("/api/v1/tasks", response_model=list[TaskRead], dependencies=[Depends(require_admin)])
async def list_tasks(session: AsyncSession = Depends(get_session), limit: int = 50):
    if not 1 <= limit <= 100:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 100")
    result = await session.scalars(select(DownloadTask).order_by(desc(DownloadTask.created_at)).limit(limit))
    return list(result.all())

@app.post("/api/v1/tasks", response_model=TaskRead, status_code=202, dependencies=[Depends(require_admin)])
async def create_task(payload: TaskCreate, request: Request, session: AsyncSession = Depends(get_session)):
    safe_url = await asyncio.to_thread(validate_public_media_url, payload.source_url, settings.allowed_hosts)
    try:
        return await enqueue_download(session, request.app.state.redis, safe_url,
                                      payload.telegram_user_id, payload.telegram_chat_id)
    except Exception:
        raise HTTPException(status_code=503, detail="Could not add task to the download queue")

@app.get("/api/v1/tasks/{task_id}", response_model=TaskRead, dependencies=[Depends(require_admin)])
async def get_task(task_id: str, session: AsyncSession = Depends(get_session)):
    task = await session.get(DownloadTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.delete("/api/v1/tasks/{task_id}", status_code=202, dependencies=[Depends(require_admin)])
async def cancel_task(task_id: str, request: Request, session: AsyncSession = Depends(get_session)):
    task = await session.get(DownloadTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status in {"queued", "downloading"}:
        await request.app.state.redis.setex("ghaem:downloads:cancel:" + task_id, 3600, "1")
        if task.status == "queued":
            task.status = "cancelled"
            await session.commit()
    return {"id": task.id, "status": "cancelled" if task.status == "cancelled" else "cancellation_requested"}

@app.get("/api/v1/tasks/{task_id}/file", dependencies=[Depends(require_admin)])
async def get_file(task_id: str, session: AsyncSession = Depends(get_session)):
    task = await session.get(DownloadTask, task_id)
    if task is None or task.status != "completed" or not task.file_path:
        raise HTTPException(status_code=404, detail="Completed file not found")
    path, root = Path(task.file_path).resolve(), Path(settings.download_dir).resolve()
    if root not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="File is no longer available")
    return FileResponse(path, filename=task.id + path.suffix, media_type="application/octet-stream")
