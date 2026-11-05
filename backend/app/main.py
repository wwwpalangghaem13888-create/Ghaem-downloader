from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Initialize dependency pools when database and queue lifecycle is implemented.
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="API foundation for Ghaem Downloader.",
    lifespan=lifespan,
    docs_url="/docs" if settings.app_env == "development" else None,
    redoc_url=None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health", tags=["operations"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "ghaem-downloader-api"}


@app.get("/ready", tags=["operations"])
async def readiness() -> dict[str, str]:
    return {"status": "ready", "dependencies": "not_checked_yet"}
