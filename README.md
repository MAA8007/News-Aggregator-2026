# News

A self-hosted editorial news aggregator with an NYT/Economist-inspired layout. Scrapes RSS feeds from dozens of sources, enriches articles via Jina AI, and presents them in a typographically refined reading experience.

---

## Features

- **Editorial layout** — hero + panel zone, secondary image strip, category section blocks, and a chronological latest feed
- **50+ RSS sources** — Financial Times, New York Times (all sections), New Yorker, VentureBeat, The Guardian, The Athletic, and more
- **Dark & light mode** — fluid animated theme transition
- **Search** — full-text search via `Cmd+K` / `Ctrl+K`
- **Bookmarks** — save articles to a local reading list (stored in the browser)
- **Custom feeds** — paste any RSS/Atom URL and scrape it into a chosen category
- **Infinite scroll** — paginated feed with IntersectionObserver
- **Auto-refresh** — feed fades in after a scrape completes
- **Category & source filtering** — sidebar with collapsible category groups and live article counts

**Categories:** Artificial Intelligence · Technology · Science & Space · Business & Finance · World News · Politics & Policy · Culture & Society · Sports · Football · Liverpool FC · Formula 1 · Pakistan

---

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion |
| Backend | FastAPI, SQLAlchemy (async), SQLite |
| Scraping | BeautifulSoup, Jina AI (optional, for full article text) |
| Fonts | Cormorant (editorial headings), Syne (UI), Inter (body) |

---

## Project Structure

```
newsagg2026/
├── frontend/          # Next.js app
│   └── app/
│       ├── components/    # UI components
│       ├── lib/           # API client, bookmarks, custom feeds
│       └── types/         # Shared TypeScript types
└── backend/           # FastAPI app
    └── app/
        ├── routers/       # API endpoints
        ├── scraper/       # RSS pipeline + Jina enrichment
        └── models/        # SQLAlchemy models
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```env
DATABASE_URL=sqlite+aiosqlite:///./news.db
JINA_API_KEY=your_key_here      # optional — enables full article content
JINA_ENABLED=true               # set to false to skip Jina
```

Start the API:

```bash
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Scraping

Trigger a full scrape (all configured RSS feeds):

```bash
curl -X POST http://localhost:8000/api/scrape
```

Or use the scrape button in the header — the feed will auto-refresh with a fade-in animation when complete.

To scrape a single custom RSS feed:

```bash
curl -X POST http://localhost:8000/api/feeds/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/feed.xml", "source": "My Blog", "category": "Technology"}'
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/news` | Paginated article feed (`?page=1&page_size=12&category=&source=`) |
| `GET` | `/api/news/search` | Full-text search (`?q=query`) |
| `GET` | `/api/news/filters` | Categories, sources, and article counts |
| `GET` | `/api/news/sections` | Per-category article pools for homepage layout |
| `POST` | `/api/scrape` | Trigger a full RSS scrape |
| `POST` | `/api/feeds/scrape` | Scrape a single custom RSS/Atom feed |

---

## Configuration

RSS feeds are defined in `backend/app/scraper/pipeline.py` as a list of tuples:

```python
(feed_url, item_tag, link_tag, title_tag, image_tag, image_attr, category, source, date_tag)
```

Custom feeds added through the UI are stored in the browser (`localStorage`) and re-scraped on demand.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./news.db` | SQLAlchemy async database URL |
| `JINA_API_KEY` | — | Jina AI key for full-text article extraction |
| `JINA_ENABLED` | `false` | Set to `true` to enable Jina enrichment |
