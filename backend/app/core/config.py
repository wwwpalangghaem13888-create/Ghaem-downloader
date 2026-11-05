from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Ghaem Downloader"
    app_env: str = "development"
    secret_key: str = Field(min_length=32)
    admin_api_key: str = ""
    dashboard_access_token: str = ""
    bot_token: str = ""
    database_url: str
    redis_url: str = "redis://redis:6379/0"
    download_dir: str = "/downloads"
    max_download_mb: int = Field(default=250, ge=1, le=2048)
    telegram_upload_limit_mb: int = Field(default=45, ge=1, le=49)
    completed_file_retention_hours: int = Field(default=24, ge=1, le=168)
    allowed_download_hosts: str = "youtube.com,youtu.be,instagram.com,tiktok.com,x.com,twitter.com,facebook.com,pinterest.com,reddit.com,soundcloud.com"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_hosts(self) -> set[str]:
        return {host.strip().lower() for host in self.allowed_download_hosts.split(",") if host.strip()}

@lru_cache
def get_settings() -> Settings:
    return Settings()
