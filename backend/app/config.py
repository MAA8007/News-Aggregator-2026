from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/newsagg"
    SYNC_DATABASE_URL: str = "postgresql+psycopg2://postgres:password@localhost:5432/newsagg"

    # Jina AI reader base URL
    JINA_BASE_URL: str = "https://r.jina.ai/"

    # Scraper tunables
    JINA_TIMEOUT_SECONDS: int = 30
    JINA_MAX_CONTENT_LENGTH: int = 50_000  # characters; prevents storing huge docs

    # Parallelization — I/O-bound, network-limited; 429s handled via retry backoff
    FEED_FETCH_WORKERS: int = 50   # concurrent RSS XML downloads
    JINA_CONCURRENCY: int = 100    # concurrent Jina AI requests

    # Set to false to skip Jina content fetching entirely (saves only metadata)
    JINA_ENABLED: bool = False


settings = Settings()
