from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

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


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    movie_states: Mapped[list["UserMovieState"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    book_states: Mapped[list["UserBookState"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    custom_movies: Mapped[list["UserCustomMovie"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    custom_books: Mapped[list["UserCustomBook"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r}>"


class UserMovieState(Base):
    __tablename__ = "user_movie_states"
    __table_args__ = (UniqueConstraint("user_id", "movie_ranking", name="uq_user_movie"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    movie_ranking: Mapped[int] = mapped_column(Integer, nullable=False)
    watched: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    in_list: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    bookmarked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship(back_populates="movie_states")


class UserBookState(Base):
    __tablename__ = "user_book_states"
    __table_args__ = (UniqueConstraint("user_id", "book_ranking", name="uq_user_book"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    book_ranking: Mapped[int] = mapped_column(Integer, nullable=False)
    read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    in_list: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    bookmarked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship(back_populates="book_states")


class UserCustomMovie(Base):
    __tablename__ = "user_custom_movies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    client_ranking: Mapped[int] = mapped_column(Integer, nullable=False)  # the ranking assigned client-side
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    director: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    overall_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    genre: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="custom_movies")


class UserCustomBook(Base):
    __tablename__ = "user_custom_books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    client_ranking: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    author: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    year_display: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    read_time: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="custom_books")
