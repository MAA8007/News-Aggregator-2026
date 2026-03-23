"""
Article repository – all database interactions for the articles table.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Article


# ---------------------------------------------------------------------------
# Read helpers
# ---------------------------------------------------------------------------

async def get_existing_links(db: AsyncSession) -> set[str]:
    """Return the full set of article URLs already in the database."""
    result = await db.execute(select(Article.link))
    return {row[0] for row in result.all()}


async def get_articles(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 20,
    category: str | None = None,
    source: str | None = None,
) -> tuple[int, list[Article]]:
    """
    Return (total_count, page_of_articles) ordered by pub_date DESC.
    Supports optional filtering by category and/or source.
    """
    base_query = select(Article)

    if category:
        base_query = base_query.where(Article.category == category)
    if source:
        base_query = base_query.where(Article.source == source)

    # Total count (reuses same filters)
    count_query = select(func.count()).select_from(base_query.subquery())
    total: int = (await db.execute(count_query)).scalar_one()

    # Paginated results
    offset = (page - 1) * page_size
    items_query = (
        base_query
        .order_by(Article.pub_date.desc().nulls_last(), Article.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    items: list[Article] = list((await db.execute(items_query)).scalars().all())

    return total, items


async def get_distinct_categories(db: AsyncSession) -> list[str]:
    result = await db.execute(select(Article.category).distinct().order_by(Article.category))
    return [row[0] for row in result.all()]


async def get_distinct_sources(db: AsyncSession) -> list[str]:
    result = await db.execute(select(Article.source).distinct().order_by(Article.source))
    return [row[0] for row in result.all()]


async def get_source_category_map(db: AsyncSession) -> dict[str, list[str]]:
    """Return {source: [category, ...]} for every source in the DB."""
    result = await db.execute(
        select(Article.source, Article.category).distinct().order_by(Article.source, Article.category)
    )
    mapping: dict[str, list[str]] = {}
    for source, category in result.all():
        mapping.setdefault(source, []).append(category)
    return mapping


async def get_category_counts(db: AsyncSession) -> dict[str, int]:
    """Return {category: article_count} for every category in the DB."""
    result = await db.execute(
        select(Article.category, func.count(Article.id)).group_by(Article.category)
    )
    return {row[0]: row[1] for row in result.all()}


async def get_source_counts(db: AsyncSession) -> dict[str, int]:
    """Return {source: article_count} for every source in the DB."""
    result = await db.execute(
        select(Article.source, func.count(Article.id)).group_by(Article.source)
    )
    return {row[0]: row[1] for row in result.all()}


async def search_articles(
    db: AsyncSession,
    *,
    q: str,
    page: int = 1,
    page_size: int = 20,
) -> tuple[int, list[Article]]:
    """Full-text search on article title (case-insensitive ILIKE)."""
    term = f"%{q}%"
    base_query = select(Article).where(Article.title.ilike(term))

    count_query = select(func.count()).select_from(base_query.subquery())
    total: int = (await db.execute(count_query)).scalar_one()

    offset = (page - 1) * page_size
    items_query = (
        base_query
        .order_by(Article.pub_date.desc().nulls_last(), Article.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    items: list[Article] = list((await db.execute(items_query)).scalars().all())

    return total, items


# ---------------------------------------------------------------------------
# Write helpers
# ---------------------------------------------------------------------------

async def save_article(
    db: AsyncSession,
    *,
    title: str,
    link: str,
    pub_date: datetime | None,
    image_url: str | None,
    source: str,
    category: str,
    content: str | None,
) -> Article:
    """
    Insert a new Article row.
    Callers are responsible for deduplication (check existing_links first).
    Raises sqlalchemy.exc.IntegrityError on duplicate link (belt-and-suspenders).
    """
    article = Article(
        title=title,
        link=link,
        pub_date=pub_date,
        image_url=image_url,
        source=source,
        category=category,
        content=content,
        # embedding left NULL – populated in Phase 2
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)
    return article
