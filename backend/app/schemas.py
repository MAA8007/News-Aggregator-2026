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
