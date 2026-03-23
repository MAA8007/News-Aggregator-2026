from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Core metadata extracted from RSS
    title: Mapped[str] = mapped_column(String(1024), nullable=False)
    link: Mapped[str] = mapped_column(String(2048), unique=True, nullable=False, index=True)
    pub_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    # Feed provenance
    source: Mapped[str] = mapped_column(String(256), nullable=False)   # e.g. "VentureBeat"
    category: Mapped[str] = mapped_column(String(256), nullable=False)  # e.g. "AI News"

    # Full article body retrieved via Jina AI Reader (raw markdown)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- Phase 2: OpenAI text-embedding-3-small produces 1536-dim vectors ---
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1536), nullable=True)

    # Housekeeping
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Optional: HNSW index on the embedding column (pgvector) – created lazily so the
    # table can be created before any embeddings exist.
    __table_args__ = (
        Index(
            "ix_articles_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    def __repr__(self) -> str:
        return f"<Article id={self.id} source={self.source!r} title={self.title[:40]!r}>"
