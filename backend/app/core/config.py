from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Ghaem Downloader"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "INFO"
    secret_key: str
    bot_token: str = ""
    database_url: str
    redis_url: str = "redis://redis:6379/0"
    max_download_mb: int = 250
    download_timeout_seconds: int = 300
    allowed_download_hosts: str = (
        "youtube.com,youtu.be,instagram.com,tiktok.com,x.com,twitter.com,"
        "facebook.com,pinterest.com,reddit.com,soundcloud.com"
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_hosts(self) -> set[str]:
        return {h.strip().lower() for h in self.allowed_download_hosts.split(",") if h.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
