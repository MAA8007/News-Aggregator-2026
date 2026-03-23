import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

_MD_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"```.*?```", re.DOTALL), ""),
    (re.compile(r"`[^`]+`"), ""),
    (re.compile(r"#{1,6}\s+"), ""),
    (re.compile(r"\*{1,2}(.+?)\*{1,2}"), r"\1"),
    (re.compile(r"_(.+?)_"), r"\1"),
    (re.compile(r"\[([^\]]+)\]\([^)]+\)"), r"\1"),
    (re.compile(r"^[-*+]\s+", re.MULTILINE), ""),
    (re.compile(r"^\d+\.\s+", re.MULTILINE), ""),
    (re.compile(r"^>\s*", re.MULTILINE), ""),
    (re.compile(r"\s+"), " "),
]

def _strip_md(text: str) -> str:
    for pattern, repl in _MD_RULES:
        text = pattern.sub(repl, text)
    return text.strip()


class ArticleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    link: str
    pub_date: datetime | None
    image_url: str | None
    source: str
    category: str
    created_at: datetime
    snippet: str = ""
    read_minutes: int = 1
    content: str | None = Field(default=None, exclude=True)

    @model_validator(mode="after")
    def _derive_from_content(self) -> "ArticleOut":
        if self.content:
            self.snippet = _strip_md(self.content)[:250]
            self.read_minutes = max(1, round(len(self.content.split()) / 238))
        return self


class PaginatedArticles(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[ArticleOut]


class ScrapeStatus(BaseModel):
    status: str
    message: str
    saved: int
    skipped: int
    errors: int


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserSignup(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    email: str = Field(min_length=3, max_length=256)
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── User data ─────────────────────────────────────────────────────────────────

class MovieStateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    movie_ranking: int
    watched: bool
    in_list: bool
    bookmarked: bool


class BookStateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    book_ranking: int
    read: bool
    in_list: bool
    bookmarked: bool


class MovieStateUpsert(BaseModel):
    watched: bool
    in_list: bool
    bookmarked: bool


class BookStateUpsert(BaseModel):
    read: bool
    in_list: bool
    bookmarked: bool


class CustomMovieIn(BaseModel):
    client_ranking: int
    title: str = Field(min_length=1, max_length=512)
    director: str = Field(default="", max_length=256)
    year: int
    overall_score: float = Field(default=0.0, ge=0, le=100)
    description: str = Field(default="", max_length=4096)
    genre: str = Field(default="", max_length=128)


class CustomMovieOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    client_ranking: int
    title: str
    director: str
    year: int
    overall_score: float
    description: str
    genre: str


class CustomBookIn(BaseModel):
    client_ranking: int
    title: str = Field(min_length=1, max_length=512)
    author: str = Field(default="", max_length=256)
    year: int
    year_display: str = Field(default="", max_length=64)
    read_time: str = Field(default="", max_length=128)
    description: str = Field(default="", max_length=4096)


class CustomBookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    client_ranking: int
    title: str
    author: str
    year: int
    year_display: str
    read_time: str
    description: str


class BulkSyncMovieStates(BaseModel):
    states: dict[int, MovieStateUpsert]


class BulkSyncBookStates(BaseModel):
    states: dict[int, BookStateUpsert]
