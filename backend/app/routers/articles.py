"""
Articles router
  GET  /api/news          – paginated, filterable article list
  GET  /api/news/filters  – available category + source values for UI dropdowns
  POST /api/scrape        – trigger a full scrape run (blocking, returns summary)
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.repositories.articles import (
    get_articles,
    get_category_counts,
    get_distinct_categories,
    get_distinct_sources,
    get_existing_links,
    get_source_category_map,
    get_source_counts,
    save_article,
    search_articles,
)
from pydantic import BaseModel
from app.schemas import ArticleOut, PaginatedArticles, ScrapeStatus
from app.scraper.pipeline import scrape_feeds, scrape_one_feed

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# GET /api/news
# ---------------------------------------------------------------------------

@router.get("/news", response_model=PaginatedArticles)
async def list_news(
    page: int = Query(default=1, ge=1, description="1-based page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    category: str | None = Query(default=None, description="Filter by category"),
    source: str | None = Query(default=None, description="Filter by source"),
    db: AsyncSession = Depends(get_db),
):
    total, items = await get_articles(
        db,
        page=page,
        page_size=page_size,
        category=category,
        source=source,
    )
    return PaginatedArticles(
        total=total,
        page=page,
        page_size=page_size,
        items=[ArticleOut.model_validate(a) for a in items],
    )


# ---------------------------------------------------------------------------
# GET /api/news/filters
# ---------------------------------------------------------------------------

@router.get("/news/filters")
async def get_filters(db: AsyncSession = Depends(get_db)):
    # Sequential awaits — AsyncSession does not allow concurrent operations
    # on the same connection (asyncio.gather would share one session and crash).
    categories        = await get_distinct_categories(db)
    sources           = await get_distinct_sources(db)
    source_categories = await get_source_category_map(db)
    category_counts   = await get_category_counts(db)
    source_counts     = await get_source_counts(db)
    return {
        "categories": categories,
        "sources": sources,
        "source_categories": source_categories,
        "category_counts": category_counts,
        "source_counts": source_counts,
    }


# ---------------------------------------------------------------------------
# GET /api/news/search
# ---------------------------------------------------------------------------

@router.get("/news/search", response_model=PaginatedArticles)
async def search_news(
    q: str = Query(min_length=1, description="Search query"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    total, items = await search_articles(db, q=q, page=page, page_size=page_size)
    return PaginatedArticles(
        total=total,
        page=page,
        page_size=page_size,
        items=[ArticleOut.model_validate(a) for a in items],
    )


# ---------------------------------------------------------------------------
# GET /api/news/sections
# ---------------------------------------------------------------------------

@router.get("/news/sections")
async def get_sections(
    categories: str = Query(description="Comma-separated category names"),
    per_category: int = Query(default=5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Return the top `per_category` most recent articles for each requested category."""
    cat_list = [c.strip() for c in categories.split(",") if c.strip()]
    result: dict[str, list[ArticleOut]] = {}
    for cat in cat_list:
        _, items = await get_articles(db, page=1, page_size=per_category, category=cat)
        result[cat] = [ArticleOut.model_validate(a) for a in items]
    return result


# ---------------------------------------------------------------------------
# POST /api/feeds/scrape  — custom user-added feed
# ---------------------------------------------------------------------------

class CustomFeedIn(BaseModel):
    url: str
    source: str
    category: str


@router.post("/feeds/scrape", response_model=ScrapeStatus)
async def scrape_custom_feed(
    payload: CustomFeedIn,
    db: AsyncSession = Depends(get_db),
):
    """Scrape a single user-supplied RSS/Atom feed URL and save new articles."""
    existing_links = await get_existing_links(db)

    def _run() -> list[dict]:
        return list(scrape_one_feed(
            feed_url=payload.url,
            category=payload.category,
            source=payload.source,
            existing_links=existing_links,
        ))

    loop = asyncio.get_event_loop()
    events: list[dict] = await loop.run_in_executor(None, _run)

    saved = skipped = errors = 0
    for event in events:
        if event.get("status") == "success":
            data: dict = event["data"]
            try:
                await save_article(db, **data)
                existing_links.add(data["link"])
                saved += 1
            except IntegrityError:
                await db.rollback()
                skipped += 1
            except Exception as exc:
                await db.rollback()
                logger.error("DB save failed: %s", exc)
                errors += 1
        elif event.get("status") == "error":
            errors += 1

    return ScrapeStatus(
        status="completed",
        message=f"Custom feed scraped. saved={saved}, skipped={skipped}, errors={errors}",
        saved=saved,
        skipped=skipped,
        errors=errors,
    )


# ---------------------------------------------------------------------------
# POST /api/scrape
# ---------------------------------------------------------------------------

@router.post("/scrape", response_model=ScrapeStatus)
async def trigger_scrape(db: AsyncSession = Depends(get_db)):
    """
    Runs the full RSS → Jina AI pipeline synchronously in a thread pool
    (scraper uses blocking `requests`), persists new articles, and returns
    a summary of what happened.
    """
    # Load existing links once before the run to use for deduplication
    existing_links = await get_existing_links(db)

    saved = skipped = errors = 0

    def _run_pipeline() -> list[dict]:
        """Execute the generator in a worker thread and collect all events."""
        return list(scrape_feeds(existing_links=existing_links))

    loop = asyncio.get_event_loop()
    events: list[dict] = await loop.run_in_executor(None, _run_pipeline)

    for event in events:
        status = event.get("status")

        if status == "success":
            data: dict = event["data"]
            try:
                await save_article(db, **data)
                existing_links.add(data["link"])  # prevent duplicates within same run
                saved += 1
                print(f"  [SAVED] {data.get('source', '?')} — {data.get('title', '?')[:70]}")
            except IntegrityError:
                # Race condition: another concurrent scrape beat us to this URL
                await db.rollback()
                skipped += 1
                print(f"  [SKIP]  {data.get('source', '?')} — {data.get('title', '?')[:70]}")
            except Exception as exc:
                await db.rollback()
                logger.error("DB save failed for %s: %s", data.get("link"), exc)
                errors += 1
                print(f"  [ERROR] {data.get('source', '?')} — {data.get('title', '?')[:70]} ({exc})")

        elif status == "info":
            logger.info(event.get("message"))

        elif status == "error":
            logger.warning(event.get("message"))
            errors += 1

    print(f"\n{'='*60}")
    print(f"  Scrape complete — saved={saved}, skipped={skipped}, errors={errors}")
    print(f"{'='*60}\n")

    return ScrapeStatus(
        status="completed",
        message=f"Scrape finished. saved={saved}, skipped={skipped}, errors={errors}",
        saved=saved,
        skipped=skipped,
        errors=errors,
    )
