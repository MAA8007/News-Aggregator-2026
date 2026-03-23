"""
RSS → Jina AI scraping pipeline.

Each public function is a generator that yields status dicts:
    {"status": "info"|"processing"|"success"|"error", "message": str, "data": dict|None}

This lets callers (e.g. a FastAPI SSE endpoint or a CLI) stream progress in real time.
"""

from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Generator

import requests
from bs4 import BeautifulSoup
from tenacity import (
    RetryError,
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Feed registry
# Each tuple: (feed_url, item_tag, link_tag, title_tag,
#              image_tag, image_attr, category, source, date_tag)
# ---------------------------------------------------------------------------
RSS_FEEDS: list[tuple[str, str, str, str, str, str, str, str, str]] = [

    # ── Artificial Intelligence ──────────────────────────────────────
    ('https://magazine.sebastianraschka.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Ahead of AI', 'pubDate'),
    ('https://venturebeat.com/category/ai/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'VentureBeat', 'pubDate'),
    ('https://ai-techpark.com/category/ai/feed/', 'item', 'link', 'title', 'content:encoded', 'img', 'Artificial Intelligence', 'AI-Tech Park', 'pubDate'),
    ('https://www.aiacceleratorinstitute.com/rss/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'AI Accelerator Institute', 'pubDate'),
    ('https://aibusiness.com/feeds/rss.xml', 'item', 'link', 'title', 'media:thumbnail', 'url', 'Artificial Intelligence', 'AI Business', 'pubDate'),
    ('https://knowtechie.com/category/ai/feed/', 'item', 'link', 'title', 'content:encoded', 'src', 'Artificial Intelligence', 'KnowTechie', 'pubDate'),
    ('https://aimodels.substack.com/feed', 'item', 'link', 'title', 'enclosure', 'url', 'Artificial Intelligence', 'AIModels.fyi', 'pubDate'),
    ('https://www.aisnakeoil.com/feed', 'item', 'link', 'title', 'enclosure', 'url', 'Artificial Intelligence', 'AI Snake Oil', 'pubDate'),
    ('https://siliconangle.com/category/ai/feed/', 'item', 'link', 'title', 'enclosure', 'url', 'Artificial Intelligence', 'SiliconANGLE', 'pubDate'),
    ('https://www.marktechpost.com/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'MarkTechPost', 'pubDate'),
    ('https://www.theguardian.com/technology/artificialintelligenceai', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'The Guardian', 'pubDate'),
    ('https://www.technologyreview.com/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'MIT Technology Review', 'pubDate'),
    ('https://news.mit.edu/topic/mitmachine-learning-rss.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'MIT News - Machine learning', 'pubDate'),

    # ── World News ───────────────────────────────────────────────────
    ('https://www.ft.com/world?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/global-economy?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/world/uk?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/world/us?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/world/africa?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/world/asia-pacific?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/world/europe?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/world/americas?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/world/mideast?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'Financial Times', 'pubDate'),

    # ── Business & Finance ───────────────────────────────────────────
    ('https://www.ft.com/companies/financials?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/companies/health?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/emerging-markets?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/companies?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/companies/energy?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/companies/industrials?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/companies/media?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/companies/professional-services?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/companies/retail-consumer?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/companies/telecoms?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/companies/transport?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'Financial Times', 'pubDate'),
    ('https://www.ft.com/markets?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'Financial Times', 'pubDate'),

    # ── Technology ───────────────────────────────────────────────────
    ('https://www.ft.com/companies/technology?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Financial Times', 'pubDate'),

    # ── Science & Space ──────────────────────────────────────────────
    ('https://www.ft.com/climate-capital?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Science & Space', 'Financial Times', 'pubDate'),

    # ── Politics & Policy ────────────────────────────────────────────
    ('https://www.ft.com/opinion?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Politics & Policy', 'Financial Times', 'pubDate'),

    # ── Culture & Society ────────────────────────────────────────────
    ('https://www.ft.com/work-careers?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'Financial Times', 'pubDate'),

    # ── New Yorker: World News ────────────────────────────────────────
    ('https://www.newyorker.com/feed/everything', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'New Yorker', 'pubDate'),
    ('https://www.newyorker.com/feed/posts', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'New Yorker', 'pubDate'),
    ('https://www.newyorker.com/feed/news', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'New Yorker', 'pubDate'),
    ('https://www.newyorker.com/feed/news/news-desk', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'New Yorker', 'pubDate'),

    # ── New Yorker: Politics & Policy ────────────────────────────────
    ('https://www.newyorker.com/feed/news/daily-comment', 'item', 'link', 'title', 'media:content', 'url', 'Politics & Policy', 'New Yorker', 'pubDate'),
    ('https://www.newyorker.com/feed/news/amy-davidson', 'item', 'link', 'title', 'media:content', 'url', 'Politics & Policy', 'New Yorker', 'pubDate'),
    ('https://www.newyorker.com/services/rss/feeds/campaign_trail.xml', 'item', 'link', 'title', 'media:content', 'url', 'Politics & Policy', 'New Yorker', 'pubDate'),

    # ── New Yorker: Business & Finance ───────────────────────────────
    ('https://www.newyorker.com/feed/news/john-cassidy', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'New Yorker', 'pubDate'),

    # ── New Yorker: Technology ────────────────────────────────────────
    ('https://www.newyorker.com/feed/tech', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'New Yorker', 'pubDate'),
    ('https://www.newyorker.com/feed/tech/elements', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'New Yorker', 'pubDate'),

    # ── New Yorker: Culture & Society ─────────────────────────────────
    ('https://www.newyorker.com/feed/magazine/rss', 'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New Yorker', 'pubDate'),
    ('https://www.newyorker.com/feed/culture', 'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New Yorker', 'pubDate'),
    ('https://www.newyorker.com/feed/culture/culture-desk', 'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New Yorker', 'pubDate'),
    ('https://www.newyorker.com/feed/culture/cultural-comment', 'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New Yorker', 'pubDate'),
    ('https://www.newyorker.com/feed/culture/photo-booth', 'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New Yorker', 'pubDate'),
    ('https://www.newyorker.com/feed/humor', 'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New Yorker', 'pubDate'),
    ('https://www.newyorker.com/feed/humor/borowitz-report', 'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New Yorker', 'pubDate'),
    ('https://www.newyorker.com/feed/cartoons/issue-cartoons', 'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New Yorker', 'pubDate'),
    ('https://www.newyorker.com/feed/cartoons/daily-cartoon', 'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New Yorker', 'pubDate'),
    ('https://www.newyorker.com/feed/books/page-turner', 'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New Yorker', 'pubDate'),
    ('https://www.newyorker.com/feed/podcast/fiction', 'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New Yorker', 'pubDate'),
    ('http://feeds.wnyc.org/tnyauthorsvoice', 'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New Yorker', 'pubDate'),

    # ── Liverpool FC ─────────────────────────────────────────────────
    ('http://www.thisisanfield.com/feed/', 'item', 'link', 'title', 'enclosure', 'url', 'Liverpool FC', 'This is Anfield', 'pubDate'),
    ('https://www.theguardian.com/football/liverpool/rss', 'item', 'link', 'title', 'media:content', 'url', 'Liverpool FC', 'The Guardian - Liverpool', 'pubDate'),
    ('https://www.skysports.com/rss/11669', 'item', 'link', 'title', 'media:content', 'url', 'Liverpool FC', 'Sky Sports', 'pubDate'),
    ('https://theathletic.com/team/liverpool/?rss=1', 'item', 'link', 'title', 'media:content', 'href', 'Liverpool FC', 'The Athletic', 'pubDate'),

    # ── Football ─────────────────────────────────────────────────────
    ('http://www.theguardian.com/football/rss', 'item', 'link', 'title', 'media:content', 'url', 'Football', 'The Guardian', 'pubDate'),
    ('https://theathletic.com/premier-league/?rss', 'item', 'link', 'title', 'media:content', 'href', 'Football', 'The Athletic', 'published'),
    ('https://theathletic.com/soccer/?rss', 'item', 'link', 'title', 'media:content', 'href', 'Football', 'The Athletic', 'published'),
    ('https://theathletic.com/champions-league/?rss', 'item', 'link', 'title', 'media:content', 'href', 'Football', 'The Athletic', 'published'),

    # ── Formula 1 ────────────────────────────────────────────────────
    ('https://www.autosport.com/rss/feed/f1', 'item', 'link', 'title', 'enclosure', 'url', 'Formula 1', 'Autosport', 'pubDate'),
    ('https://the-race.com/category/formula-1/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Formula 1', 'The Race', 'pubDate'),

    # ── Culture & Society ─────────────────────────────────────────────
    ('https://aeon.co/feed.rss', 'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'Aeon', 'pubDate'),
    ('https://psyche.co/feed', 'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'Psyche', 'pubDate'),

    # ── NYT ──────────────────────────────────────────────────────────
    ('https://rss.nytimes.com/services/xml/rss/nyt/Opinion.xml',    'item', 'link', 'title', 'media:content', 'url', 'Politics & Policy', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Magazine.xml',   'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Science.xml',    'item', 'link', 'title', 'media:content', 'url', 'Science & Space',   'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml',     'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Style.xml',      'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', 'item', 'link', 'title', 'media:content', 'url', 'Technology',        'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',   'item', 'link', 'title', 'media:content', 'url', 'Business & Finance','New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',   'item', 'link', 'title', 'media:content', 'url', 'World News',        'New York Times', 'pubDate'),

    # NYT — World
    ('https://rss.nytimes.com/services/xml/rss/nyt/World.xml',      'item', 'link', 'title', 'media:content', 'url', 'World News', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Africa.xml',     'item', 'link', 'title', 'media:content', 'url', 'World News', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Americas.xml',   'item', 'link', 'title', 'media:content', 'url', 'World News', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/AsiaPacific.xml','item', 'link', 'title', 'media:content', 'url', 'World News', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Europe.xml',     'item', 'link', 'title', 'media:content', 'url', 'World News', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Obituaries.xml', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/TimeWire.xml',   'item', 'link', 'title', 'media:content', 'url', 'World News', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/MostViewed.xml', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/MostShared.xml', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/MostEmailed.xml','item', 'link', 'title', 'media:content', 'url', 'World News', 'New York Times', 'pubDate'),

    # NYT — Politics & Policy
    ('https://rss.nytimes.com/services/xml/rss/nyt/US.xml',         'item', 'link', 'title', 'media:content', 'url', 'Politics & Policy', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml',   'item', 'link', 'title', 'media:content', 'url', 'Politics & Policy', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Upshot.xml',     'item', 'link', 'title', 'media:content', 'url', 'Politics & Policy', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Education.xml',  'item', 'link', 'title', 'media:content', 'url', 'Politics & Policy', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/NYRegion.xml',   'item', 'link', 'title', 'media:content', 'url', 'Politics & Policy', 'New York Times', 'pubDate'),

    # NYT — Business & Finance
    ('https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml',             'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/DealBook.xml',            'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/SmallBusiness.xml',       'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/EnergyEnvironment.xml',   'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/MediaAndAdvertising.xml', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/YourMoney.xml',           'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/RealEstate.xml',          'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Jobs.xml',                'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Automobiles.xml',         'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'New York Times', 'pubDate'),

    # NYT — Technology
    ('https://rss.nytimes.com/services/xml/rss/nyt/PersonalTech.xml', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'New York Times', 'pubDate'),

    # NYT — Science & Space
    ('https://rss.nytimes.com/services/xml/rss/nyt/Environment.xml', 'item', 'link', 'title', 'media:content', 'url', 'Science & Space', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Space.xml',       'item', 'link', 'title', 'media:content', 'url', 'Science & Space', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Health.xml',      'item', 'link', 'title', 'media:content', 'url', 'Science & Space', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Well.xml',        'item', 'link', 'title', 'media:content', 'url', 'Science & Space', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Climate.xml',     'item', 'link', 'title', 'media:content', 'url', 'Science & Space', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Weather.xml',     'item', 'link', 'title', 'media:content', 'url', 'Science & Space', 'New York Times', 'pubDate'),

    # NYT — Culture & Society
    ('https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml',           'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/ArtAndDesign.xml',   'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/BookReview.xml',     'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Dance.xml',          'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Movies.xml',         'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Music.xml',          'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Television.xml',     'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Theater.xml',        'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/FashionAndStyle.xml','item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/DiningAndWine.xml',  'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Love.xml',           'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/TStyle.xml',         'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Lens.xml',           'item', 'link', 'title', 'media:content', 'url', 'Culture & Society', 'New York Times', 'pubDate'),

    # NYT — Sports
    ('https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml',          'item', 'link', 'title', 'media:content', 'url', 'Sports', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Baseball.xml',        'item', 'link', 'title', 'media:content', 'url', 'Sports', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/CollegeBasketball.xml','item', 'link', 'title', 'media:content', 'url', 'Sports', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/CollegeFootball.xml', 'item', 'link', 'title', 'media:content', 'url', 'Sports', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Golf.xml',            'item', 'link', 'title', 'media:content', 'url', 'Sports', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Hockey.xml',          'item', 'link', 'title', 'media:content', 'url', 'Sports', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/ProBasketball.xml',   'item', 'link', 'title', 'media:content', 'url', 'Sports', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/ProFootball.xml',     'item', 'link', 'title', 'media:content', 'url', 'Sports', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Soccer.xml',          'item', 'link', 'title', 'media:content', 'url', 'Football', 'New York Times', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Tennis.xml',          'item', 'link', 'title', 'media:content', 'url', 'Sports', 'New York Times', 'pubDate'),

    # ── Science & Space ───────────────────────────────────────────────
    ('http://www.smithsonianmag.com/rss/innovation/', 'item', 'link', 'title', 'enclosure', 'url', 'Science & Space', 'Smithsonian', 'pubDate'),
    ('http://www.smithsonianmag.com/rss/latest_articles/', 'item', 'link', 'title', 'enclosure', 'url', 'Science & Space', 'Smithsonian', 'pubDate'),

    # ── Pakistan ──────────────────────────────────────────────────────
    ('http://feeds.feedburner.com/dawn-news', 'item', 'link', 'title', 'media:content', 'url', 'Pakistan', 'Dawn', 'pubDate'),
    ('https://feeds.feedburner.com/dawn-news-world', 'item', 'link', 'title', 'media:content', 'url', 'World News', 'Dawn', 'pubDate'),

    # ── The Verge ─────────────────────────────────────────────────────
    #('http://www.theverge.com/android/rss/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    # ('http://www.theverge.com/apple/rss/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    # ('http://www.theverge.com/apps/rss/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/climate-change/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Science & Space', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/cryptocurrency/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Business & Finance', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/creators/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/cyber-security/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/good-deals/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/film/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Culture & Society', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/gadgets/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/games/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/google/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/hot-pod-newsletter/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/how-to/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/meta/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    # ('http://www.theverge.com/microsoft/rss/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('http://www.theverge.com/policy/rss/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Politics & Policy', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/reviews/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/samsung/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/science/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Science & Space', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/space/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Science & Space', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/streaming-wars/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Culture & Society', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/tesla/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/the-vergecast/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/tiktok/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/transportation/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/tv/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Culture & Society', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/twitter/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('https://www.theverge.com/rss/youtube/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
]


NEW_RSS_FEEDS = [
    # ── Technology ───────────────────────────────────────────────────
    ('https://www.404media.co/rss', 'item', 'link', 'title', 'media:content', 'url', 'Technology', '404 Media', 'pubDate'),

    # ── Artificial Intelligence ──────────────────────────────────────
    ('https://magazine.sebastianraschka.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Ahead of AI', 'pubDate'),
    ('https://aiacceleratorinstitute.com/rss/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'AI Accelerator Institute', 'pubDate'),
    ('https://ai-techpark.com/category/ai/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'AI-TechPark', 'pubDate'),
    ('https://knowtechie.com/category/ai/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'KnowTechie', 'pubDate'),
    ('https://aibusiness.com/rss.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'AI Business', 'pubDate'),
    ('https://aimodels.substack.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'AIModels.fyi', 'pubDate'),
    ('https://www.artificialintelligence-news.com/feed/rss/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'AI News', 'pubDate'),
    ('https://venturebeat.com/category/ai/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'VentureBeat', 'pubDate'),
    ('https://ainowinstitute.org/category/news/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'AI Now Institute', 'pubDate'),
    ('https://siliconangle.com/category/ai/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'SiliconANGLE', 'pubDate'),
    ('https://aisnakeoil.substack.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'AI Snake Oil', 'pubDate'),
    ('https://eng.uber.com/category/articles/ai/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Uber Engineering Blog', 'pubDate'),
    ('https://stability.ai/blog?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Stability AI', 'pubDate'),
    ('https://theconversation.com/europe/topics/artificial-intelligence-ai-90/articles.atom', 'entry', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'The Conversation', 'published'),
    ('https://www.theguardian.com/technology/artificialintelligenceai/rss', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'The Guardian', 'pubDate'),
    ('https://futurism.com/categories/ai-artificial-intelligence/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Futurism', 'pubDate'),
    ('https://www.wired.com/feed/tag/ai/latest/rss', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Wired', 'pubDate'),
    ('https://www.techrepublic.com/rssfeeds/topic/artificial-intelligence/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'TechRepublic', 'pubDate'),
    ('https://machinelearningmastery.com/blog/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Machine Learning Mastery', 'pubDate'),
    ('https://www.together.xyz/blog?format=rss', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'TOGETHER', 'pubDate'),
    ('https://neptune.ai/blog/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'neptune.ai', 'pubDate'),
    ('https://pyimagesearch.com/blog/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'PyImageSearch', 'pubDate'),
    ('https://every.to/chain-of-thought/feed.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Chain of Thought', 'pubDate'),
    ('https://huyenchip.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Chip Huyen', 'pubDate'),
    ('https://txt.cohere.ai/rss/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Cohere', 'pubDate'),
    ('https://debuggercafe.com/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'DebuggerCafe', 'pubDate'),
    ('https://deepmind.com/blog/feed/basic/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'DeepMind', 'pubDate'),
    ('https://eugeneyan.com/rss/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Eugene Yan', 'pubDate'),
    ('https://explosion.ai/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Explosion', 'pubDate'),
    ('https://www.generational.pub/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Generational', 'pubDate'),
    ('https://www.forrester.com/blogs/category/artificial-intelligence-ai/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Forrester', 'pubDate'),
    ('https://globalnews.ca/tag/artificial-intelligence/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Global News', 'pubDate'),
    ('http://googleaiblog.blogspot.com/atom.xml', 'entry', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Google AI Blog', 'published'),
    ('https://hackernoon.com/tagged/ai/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Hacker Noon', 'pubDate'),
    ('https://huggingface.co/blog/feed.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Hugging Face', 'pubDate'),
    ('https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'IEEE Spectrum', 'pubDate'),
    ('https://www.infoworld.com/category/machine-learning/index.rss', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'InfoWorld', 'pubDate'),
    ('https://www.interconnects.ai/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Interconnects', 'pubDate'),
    ('https://blog.langchain.dev/rss/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'LangChain', 'pubDate'),
    ('https://lastweekin.ai/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Last Week in AI', 'pubDate'),
    ('https://www.latent.space/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Latent Space', 'pubDate'),
    ('https://www.zdnet.com/topic/artificial-intelligence/rss.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'ZDNET', 'pubDate'),
    ('https://lightning.ai/pages/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Lightning AI', 'pubDate'),
    ('https://www.marktechpost.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'MarkTechPost', 'pubDate'),
    ('https://www.technologyreview.com/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'MIT Technology Review', 'pubDate'),
    ('https://developer.nvidia.com/blog/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'NVIDIA', 'pubDate'),
    ('https://www.oneusefulthing.org/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'One Useful Thing', 'pubDate'),
    ('https://openai.com/blog/rss/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'OpenAI', 'pubDate'),
    ('https://blog.paperspace.com/rss/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Paperspace', 'pubDate'),
    ('https://www.philschmid.de/feed.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'philschmid', 'pubDate'),
    ('https://erichartford.com/rss.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Playing with AI', 'pubDate'),
    ('https://minimaxir.com/post/index.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Max Woolf', 'pubDate'),
    ('https://medium.com/feed/radix-ai-blog', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Medium - Radix', 'pubDate'),
    ('https://replicate.com/blog/rss', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Replicate', 'pubDate'),
    ('https://notes.replicatecodex.com/rss/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Replicate Codex', 'pubDate'),
    ('https://simonwillison.net/atom/everything/', 'entry', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Simon Willison', 'published'),
    ('https://syncedreview.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Synced', 'pubDate'),
    ('https://synthedia.substack.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Synthedia', 'pubDate'),
    ('https://thealgorithmicbridge.substack.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'The Algorithmic Bridge', 'pubDate'),
    ('https://the-decoder.com/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'THE DECODER', 'pubDate'),
    ('https://thenextweb.com/neural/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'The Next Web', 'pubDate'),
    ('https://www.theregister.com/software/ai_ml/headlines.atom', 'entry', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'The Register', 'updated'),
    ('https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'The Rundown AI', 'pubDate'),
    ('https://thesequence.substack.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'TheSequence', 'pubDate'),
    ('https://blog.tensorflow.org/feeds/posts/default?alt=rss', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'TensorFlow', 'pubDate'),
    ('http://feeds.libsyn.com/102459/rss', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Voicebot Podcast', 'pubDate'),
    ('https://pub.towardsai.net/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Medium - Towards AI', 'pubDate'),
    ('https://www.unite.ai/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Unite.AI', 'pubDate'),
    ('https://unwindai.substack.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Unwind AI', 'pubDate'),
    ('https://www.vice.com/en/rss/topic/ai', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'VICE', 'pubDate'),
    ('https://voicebot.ai/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Voicebot.ai', 'pubDate'),
    ('https://wandb.ai/fully-connected/rss.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Weights & Biases', 'pubDate'),
    ('https://aihub.org/feed?cat=-473', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'AIhub', 'pubDate'),
    ('https://www.anaconda.com/blog/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Anaconda Blog', 'pubDate'),
    ('https://analyticsindiamag.com/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Analytics India Magazine', 'pubDate'),
    ('https://medium.com/feed/artificialis', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Medium - Artificialis', 'pubDate'),
    ('https://siliconangle.com/category/big-data/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'SiliconANGLE', 'pubDate'),
    ('https://dagshub.com/blog/rss/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'DagsHub', 'pubDate'),
    ('https://www.databricks.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Databricks', 'pubDate'),
    ('https://datafloq.com/feed/?post_type=post', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Datafloq', 'pubDate'),
    ('https://datamachina.substack.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Data Machina', 'pubDate'),
    ('https://www.datanami.com/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Datanami', 'pubDate'),
    ('https://deephaven.io/blog/rss.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Deephaven', 'pubDate'),
    ('https://gradientflow.com/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Gradient Flow', 'pubDate'),
    ('https://feed.infoq.com/ai-ml-data-eng/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'InfoQ', 'pubDate'),
    ('https://www.infoworld.com/category/analytics/index.rss', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'InfoWorld', 'pubDate'),
    ('https://insidebigdata.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'insideBIGDATA', 'pubDate'),
    ('https://www.kdnuggets.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'KDnuggets', 'pubDate'),
    ('https://www.zdnet.com/topic/big-data/rss.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'ZDNET', 'pubDate'),
    ('https://www.bmc.com/blogs/categories/machine-learning-big-data/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'BMC Software', 'pubDate'),
    ('https://medium.com/feed/@odsc', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Medium - ODSC', 'pubDate'),
    ('https://feeds.feedburner.com/RBloggers', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'R-bloggers', 'pubDate'),
    ('https://arxiv.org/rss/stat.ML', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'arXiv - stat.ML', 'pubDate'),
    ('https://towardsdatascience.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Medium - Towards Data Science', 'pubDate'),
    ('https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'ScienceDaily', 'pubDate'),
    ('https://davidstutz.de/category/blog/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'David Stutz', 'pubDate'),
    ('https://blog.eleuther.ai/index.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'EleutherAI', 'pubDate'),
    ('https://www.jmlr.org/jmlr.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'JMLR', 'pubDate'),
    ('https://blog.ml.cmu.edu/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'ML@CMU', 'pubDate'),
    ('https://www.nature.com/subjects/machine-learning.rss', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Nature', 'pubDate'),
    ('https://www.microsoft.com/en-us/research/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Microsoft Research', 'pubDate'),
    ('https://mila.quebec/en/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Mila', 'pubDate'),
    ('https://news.mit.edu/topic/mitmachine-learning-rss.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'MIT News', 'pubDate'),
    ('https://nicholas.carlini.com/writing/feed.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Nicholas Carlini', 'pubDate'),
    ('https://arxiv.org/rss/cs.CL', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'arXiv - cs.CL', 'pubDate'),
    ('https://arxiv.org/rss/cs.CV', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'arXiv - cs.CV', 'pubDate'),
    ('https://arxiv.org/rss/cs.LG', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'arXiv - cs.LG', 'pubDate'),
    ('https://bair.berkeley.edu/blog/feed.xml', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'BAIR', 'pubDate'),
    ('https://thegradient.pub/rss/', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'The Gradient', 'pubDate'),
    ('https://crfm.stanford.edu/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Stanford CRFM', 'pubDate'),

    # ── Technology ───────────────────────────────────────────────────
    ('https://feeds.arstechnica.com/arstechnica/index', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Ars Technica', 'pubDate'),
    ('https://feeds.bloomberg.com/technology/news.rss', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Bloomberg', 'pubDate'),
    ('http://www.computerworld.com/index.rss', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Computerworld', 'pubDate'),
    ('https://tech.eu/category/deep-tech/feed', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Tech.eu', 'pubDate'),
    ('https://departmentofproduct.substack.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Department of Product', 'pubDate'),
    ('https://dev.to/feed', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'DEV Community', 'pubDate'),
    ('https://www.eetimes.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'EE Times', 'pubDate'),
    ('https://www.engadget.com/rss.xml', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Engadget', 'pubDate'),
    ('https://www.ghacks.net/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'gHacks', 'pubDate'),
    ('https://gizmodo.com/rss', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Gizmodo', 'pubDate'),
    ('https://feeds.feedburner.com/HealthTechMagazine', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'HealthTech Magazine', 'pubDate'),
    ('https://foundation.mozilla.org/en/blog/rss/', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Mozilla', 'pubDate'),
    ('https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'New York Times', 'pubDate'),
    ('https://petapixel.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'PetaPixel', 'pubDate'),
    ('https://feeds.feedburner.com/PythonInsider', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Python Insider', 'pubDate'),
    ('https://tech.eu/category/robotics/feed', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Tech.eu', 'pubDate'),
    ('https://www.semianalysis.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'SemiAnalysis', 'pubDate'),
    ('https://www.siliconrepublic.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Silicon Republic', 'pubDate'),
    ('https://sifted.eu/feed/?post_type=article', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Sifted', 'pubDate'),
    ('https://stackoverflow.blog/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Stack Overflow', 'pubDate'),
    ('https://medium.com/feed/@netflixtechblog', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Medium - Netflix', 'pubDate'),
    ('https://techmonitor.ai/feed', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Tech Monitor', 'pubDate'),
    ('https://www.reutersagency.com/feed/?best-topics=tech', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Reuters', 'pubDate'),
    ('https://www.techspot.com/backend.xml', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'TechSpot', 'pubDate'),
    ('https://bdtechtalks.com/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'TechTalks', 'pubDate'),
    ('https://www.theinformation.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'The Information', 'pubDate'),
    ('https://thenewstack.io/feed', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'The New Stack', 'pubDate'),
    ('https://www.thestack.technology/latest/rss/', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'The Stack', 'pubDate'),
    ('https://www.theverge.com/rss/index.xml', 'entry', 'id', 'title', 'media:content', 'url', 'Technology', 'The Verge', 'published'),
    ('https://visualstudiomagazine.com/rss-feeds/news.aspx', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Visual Studio Magazine', 'pubDate'),
    ('https://blogs.windows.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Windows Blog', 'pubDate'),
    ('https://www.techmeme.com/feed.xml', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Techmeme', 'pubDate'),
    ('https://techcrunch.com/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'TechCrunch', 'pubDate'),

    # ── Cybersecurity ────────────────────────────────────────────────
    ('https://www.darkreading.com/rss_simple.asp', 'item', 'link', 'title', 'media:content', 'url', 'Technology', 'Dark Reading', 'pubDate'),

    # ── Science & Space ───────────────────────────────────────────────
    ('https://spacenews.com/tag/artificial-intelligence/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Science & Space', 'SpaceNews', 'pubDate'),
    ('https://www.freethink.com/feed/all', 'item', 'link', 'title', 'media:content', 'url', 'Science & Space', 'Freethink', 'pubDate'),
    ('https://www.sciencedaily.com/rss/computers_math/neural_interfaces.xml', 'item', 'link', 'title', 'media:content', 'url', 'Science & Space', 'ScienceDaily', 'pubDate'),
    ('https://www.newscientist.com/subject/technology/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Science & Space', 'New Scientist', 'pubDate'),
    ('https://api.quantamagazine.org/feed', 'item', 'link', 'title', 'media:content', 'url', 'Science & Space', 'Quanta Magazine', 'pubDate'),
    ('https://www.sciencedaily.com/rss/computers_math/robotics.xml', 'item', 'link', 'title', 'media:content', 'url', 'Science & Space', 'ScienceDaily', 'pubDate'),
    ('http://rss.sciam.com/ScientificAmerican-Global', 'item', 'link', 'title', 'media:content', 'url', 'Science & Space', 'Scientific American', 'pubDate'),
    ('https://blog.wolfram.com/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Science & Space', 'Wolfram', 'pubDate'),

    # ── Business & Finance ───────────────────────────────────────────
    ('https://feeds.businessinsider.com/custom/all', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'Business Insider', 'pubDate'),
    ('https://www.wired.com/feed/category/business/latest/rss', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'Wired', 'pubDate'),
    ('https://www.ibtimes.com/rss', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'International Business Times', 'pubDate'),
    ('https://www.thetradenews.com/feed/', 'item', 'link', 'title', 'media:content', 'url', 'Business & Finance', 'The TRADE', 'pubDate'),

    ('https://news.crunchbase.com/feed', 'item', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Crunchbase News', 'pubDate'),
    ('https://www.producthunt.com/feed', 'entry', 'link', 'title', 'media:content', 'url', 'Artificial Intelligence', 'Product Hunt', 'published'),
]

RSS_FEEDS.extend(NEW_RSS_FEEDS)


# ---------------------------------------------------------------------------
# Single-feed scraper (for custom / user-added feeds)
# ---------------------------------------------------------------------------

def scrape_one_feed(
    feed_url: str,
    category: str,
    source: str,
    existing_links: set[str] | None = None,
) -> Generator[StatusDict, None, None]:
    """
    Scrape a single RSS or Atom feed URL with generic auto-detection.
    Supports both RSS (<item>) and Atom (<entry>) formats.
    Yields the same StatusDicts as scrape_feeds().
    """
    if existing_links is None:
        existing_links = set()

    yield _make_status("info", f"Fetching custom feed: {feed_url}")
    xml_bytes = _fetch_feed_xml(feed_url)
    if xml_bytes is None:
        yield _make_status("error", f"Could not fetch feed: {feed_url}")
        return

    try:
        soup = BeautifulSoup(xml_bytes, "xml")
    except Exception as exc:
        yield _make_status("error", f"XML parse error: {exc}")
        return

    # Support both RSS (item) and Atom (entry)
    items = soup.find_all("item") or soup.find_all("entry")
    if not items:
        yield _make_status("error", f"No items/entries found in feed: {feed_url}")
        return

    yield _make_status("info", f"Found {len(items)} items in feed")

    articles: list[dict] = []
    for item in items:
        # Link: <link href="…"/> (Atom), <link>…</link> (RSS), or <id>
        link: str | None = None
        link_el = item.find("link")
        if link_el:
            link = link_el.get("href") or link_el.get_text(strip=True) or None
        if not link:
            id_el = item.find("id")
            if id_el:
                link = id_el.get_text(strip=True) or None
        if not link or link in existing_links:
            continue

        title_el = item.find("title")
        title = title_el.get_text(strip=True) if title_el else "Untitled"

        pub_date = None
        for date_tag in ("pubDate", "published", "updated", "dc:date"):
            date_el = item.find(date_tag)
            if date_el:
                pub_date = _parse_date(date_el.get_text(strip=True))
                if pub_date:
                    break

        articles.append({
            "title": title,
            "link": link,
            "pub_date": pub_date,
            "image_url": _extract_image(item, source, feed_url),
            "source": source,
            "category": category,
        })

    total_articles = len(articles)
    yield _make_status("info", f"{total_articles} new articles to process")

    if not settings.JINA_ENABLED:
        for article in articles:
            yield _make_status("success", f"Saved: {article['title'][:60]}",
                               data={**article, "content": None})
        return

    workers = max(1, min(settings.JINA_CONCURRENCY, total_articles))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        future_to_article = {pool.submit(_fetch_jina, a["link"]): a for a in articles}
        for future in as_completed(future_to_article):
            article = future_to_article[future]
            content: str | None = None
            try:
                content = future.result()
            except Exception:
                pass
            yield _make_status("success", f"Scraped: {article['title'][:60]}",
                               data={**article, "content": content})

# ---------------------------------------------------------------------------
# Type alias for status payloads
# ---------------------------------------------------------------------------
StatusDict = dict[str, object]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_status(
    status: str,
    message: str,
    data: dict | None = None,
) -> StatusDict:
    return {"status": status, "message": message, "data": data}


def _parse_date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return parsedate_to_datetime(raw)
    except Exception:
        try:
            # Atom-style: 2024-01-15T10:30:00Z
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except Exception:
            return None


# ---------------------------------------------------------------------------
# Per-source image extraction
# ---------------------------------------------------------------------------

def _extract_image(item, source: str, feed_url: str) -> str | None:
    """
    Extract an image URL from a feed item using per-source logic.
    Falls back to a generic media:content / enclosure search if the source
    is not explicitly handled.
    """

    def _first_img_src(html: str) -> str | None:
        s = BeautifulSoup(html, "html.parser")
        tag = s.find("img")
        return tag.get("src") if tag else None

    if source == "Ahead of AI":
        enc = item.find("enclosure")
        return enc["url"] if enc else None

    if source == "VentureBeat":
        el = item.find("media:content")
        if el and el.get("url"):
            return el["url"]
        ce = item.find("content:encoded")
        return _first_img_src(ce.text) if ce else None

    if source == "AI-Tech Park":
        ce = item.find("content:encoded")
        if ce:
            img = _first_img_src(ce.text)
            if img:
                return img
        desc = item.find("description")
        return _first_img_src(desc.text) if desc else None

    if source == "AI Accelerator Institute":
        el = item.find("media:content")
        if el and el.get("url"):
            return el["url"]
        ce = item.find("content:encoded")
        return _first_img_src(ce.text) if ce else None

    if source == "AI Business":
        el = item.find("media:thumbnail")
        if el and el.get("url"):
            return el["url"]
        el = item.find("media:content")
        return el["url"] if el and el.get("url") else None

    if source == "KnowTechie":
        ce = item.find("content:encoded")
        return _first_img_src(ce.text) if ce else None

    if source == "AIModels.fyi":
        enc = item.find("enclosure")
        if enc and enc.get("type", "").startswith("image/"):
            return enc["url"]
        ce = item.find("content:encoded")
        return _first_img_src(ce.text) if ce else None

    if source == "AI Snake Oil":
        enc = item.find("enclosure")
        if enc and enc.get("url"):
            return enc["url"]
        ce = item.find("content:encoded")
        return _first_img_src(ce.text) if ce else None

    if source == "SiliconANGLE":
        enc = item.find("enclosure")
        if enc and enc.get("url"):
            return enc["url"]
        el = item.find("media:content")
        if el and el.get("url"):
            return el["url"]
        el = item.find("media:thumbnail")
        return el["url"] if el and el.get("url") else None

    if source == "MarkTechPost":
        desc = item.find("description")
        if desc:
            img = _first_img_src(desc.text)
            if img:
                return img
        el = item.find("media:content")
        return el["url"] if el and el.get("url") else None

    if source in ("The Guardian", "Artificial intelligence (AI) | The Guardian"):
        # Pick the media:content tag with the largest width
        best_url, best_width = None, 0
        for t in item.find_all("media:content"):
            if t.get("url") and t.get("width"):
                try:
                    w = int(t["width"])
                    if w > best_width:
                        best_width, best_url = w, t["url"]
                except ValueError:
                    pass
        return best_url

    if source in ("MIT News - Machine learning", "MIT Technology Review", "Financial Times"):
        el = item.find("media:content")
        return el["url"] if el and el.get("url") else None

    if source == "New Yorker":
        el = item.find("media:thumbnail")
        if el and el.get("url"):
            return el["url"]
        el = item.find("media:content")
        return el["url"] if el and el.get("url") else None

    if source == "This is Anfield":
        el = item.find("media:thumbnail")
        if el and el.get("url"):
            return el["url"]
        enc = item.find("enclosure")
        return enc["url"] if enc and enc.get("url") else None

    if source == "The Athletic":
        el = item.find("media:content")
        if el:
            return el.get("href") or el.get("url")
        if "liverpool" in feed_url:
            return "https://images.unsplash.com/photo-1518188049456-7a3a9e263ab2?auto=format&fit=crop&w=1674&q=80"
        return "https://images.unsplash.com/photo-1486286701208-1d58e9338013?auto=format&fit=crop&w=1770&q=80"

    if source == "Autosport":
        enc = item.find("enclosure")
        if enc and enc.get("url"):
            return enc["url"]
        return "https://images.unsplash.com/photo-1656337449909-141091f4df4a?auto=format&fit=crop&w=774&q=80"

    if source == "The Race":
        el = item.find("media:content")
        if el and el.get("url"):
            return el["url"]
        return "https://images.unsplash.com/photo-1656337449909-141091f4df4a?auto=format&fit=crop&w=774&q=80"

    if source in ("Aeon", "Psyche"):
        desc = item.find("description")
        return _first_img_src(desc.text) if desc else None

    if source == "New York Times":
        el = item.find("media:content")
        return el["url"] if el and el.get("url") else None

    if source == "New York Times Wirecutter":
        desc = item.find("description")
        return _first_img_src(desc.text) if desc else None

    if source == "Smithsonian":
        enc = item.find("enclosure")
        return enc["url"] if enc and enc.get("url") else None

    if source == "Dawn":
        el = item.find("media:content")
        return el["url"] if el and el.get("url") else None

    if source == "The Verge":
        content = item.find("content")
        return _first_img_src(content.text) if content else None

    # Generic fallback for any unrecognised source
    el = item.find("media:content")
    if el and el.get("url"):
        return el["url"]
    enc = item.find("enclosure")
    return enc["url"] if enc and enc.get("url") else None


# ---------------------------------------------------------------------------
# Tenacity-wrapped Jina AI fetch
# ---------------------------------------------------------------------------

def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, (requests.Timeout, requests.ConnectionError)):
        return True
    if isinstance(exc, requests.HTTPError):
        resp = getattr(exc, "response", None)
        return resp is not None and resp.status_code == 429
    return False


@retry(
    retry=retry_if_exception(_is_retryable),
    wait=wait_exponential(multiplier=2, min=3, max=20),
    stop=stop_after_attempt(2),   # fail fast — article saved without content
    reraise=False,
)
def _fetch_jina(url: str) -> str | None:
    """
    Fetch clean markdown for *url* via Jina AI Reader.
    Retries on transient network errors and 429 rate-limit responses
    with exponential backoff (5s → 60s).
    """
    jina_url = f"{settings.JINA_BASE_URL}{url}"
    response = requests.get(
        jina_url,
        timeout=settings.JINA_TIMEOUT_SECONDS,
        headers={"Accept": "text/plain"},
    )
    response.raise_for_status()
    content = response.text
    # Truncate to avoid storing enormous documents
    return content[: settings.JINA_MAX_CONTENT_LENGTH]


# ---------------------------------------------------------------------------
# RSS feed fetcher
# ---------------------------------------------------------------------------

_FEED_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/rss+xml, application/xml, text/xml, */*;q=0.9",
    "Accept-Language": "en-US,en;q=0.9",
}


def _fetch_feed_xml(feed_url: str) -> bytes | None:
    try:
        resp = requests.get(feed_url, timeout=20, headers=_FEED_HEADERS)
        resp.raise_for_status()
        return resp.content
    except Exception as exc:
        logger.warning("Failed to fetch feed %s: %s", feed_url, exc)
        return None


# ---------------------------------------------------------------------------
# Core generator pipeline
# ---------------------------------------------------------------------------

def scrape_feeds(
    existing_links: set[str] | None = None,
) -> Generator[StatusDict, None, None]:
    """
    Parallel RSS → Jina AI pipeline.

    Phase 1 — fetch all RSS feeds concurrently (FEED_FETCH_WORKERS threads).
    Phase 2 — parse feeds and collect new articles (sequential, CPU-light).
    Phase 3 — fetch article content via Jina AI concurrently (JINA_CONCURRENCY
               threads) with 429-aware exponential-backoff retries.

    Yields StatusDicts throughout so callers can stream progress.
    """
    if existing_links is None:
        existing_links = set()

    total_feeds = len(RSS_FEEDS)
    print(f"\n{'='*60}")
    print(f"  Scrape started — {total_feeds} feeds to process")
    print(f"{'='*60}")

    # -----------------------------------------------------------------------
    # Phase 1: fetch all RSS feeds in parallel
    # -----------------------------------------------------------------------
    print(f"\n[Phase 1] Fetching {total_feeds} RSS feeds "
          f"({settings.FEED_FETCH_WORKERS} workers)…")
    yield _make_status("info", f"Fetching {total_feeds} RSS feeds in parallel…")

    feed_xml: dict[int, bytes | None] = {}   # index → raw XML
    with ThreadPoolExecutor(max_workers=settings.FEED_FETCH_WORKERS) as pool:
        future_to_idx = {
            pool.submit(_fetch_feed_xml, cfg[0]): i
            for i, cfg in enumerate(RSS_FEEDS)
        }
        done = 0
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            source = RSS_FEEDS[idx][7]
            xml_bytes = future.result()   # _fetch_feed_xml never raises
            feed_xml[idx] = xml_bytes
            done += 1
            tag = "OK  " if xml_bytes else "FAIL"
            print(f"  [{done:>3}/{total_feeds}] {tag} — {source}")

    # -----------------------------------------------------------------------
    # Phase 2: parse feeds, deduplicate, collect articles
    # -----------------------------------------------------------------------
    print(f"\n[Phase 2] Parsing feeds and collecting new articles…")

    articles: list[dict] = []
    for idx, cfg in enumerate(RSS_FEEDS):
        (feed_url, item_tag, link_tag, title_tag,
         _, _, category, source, date_tag) = cfg

        xml_bytes = feed_xml.get(idx)
        if xml_bytes is None:
            yield _make_status("error", f"[{source}] Could not retrieve feed, skipping.")
            continue

        try:
            soup = BeautifulSoup(xml_bytes, "xml")
        except Exception as exc:
            yield _make_status("error", f"[{source}] XML parse error: {exc}")
            continue

        items = soup.find_all(item_tag)
        new_in_feed = 0
        for item in items:
            link_el = item.find(link_tag)
            if link_el is None:
                continue
            link = (link_el.get_text(strip=True) or "").strip()
            if not link or link in existing_links:
                continue

            title_el = item.find(title_tag)
            title = title_el.get_text(strip=True) if title_el else "Untitled"

            date_el = item.find(date_tag)
            pub_date = _parse_date(date_el.get_text(strip=True) if date_el else None)

            articles.append({
                "title": title,
                "link": link,
                "pub_date": pub_date,
                "image_url": _extract_image(item, source, feed_url),
                "source": source,
                "category": category,
            })
            new_in_feed += 1

        print(f"  {source}: {new_in_feed} new articles")
        yield _make_status("info", f"[{source}] {new_in_feed} new articles queued.")

    total_articles = len(articles)

    if not settings.JINA_ENABLED:
        print(f"\n[Phase 3] Jina disabled — saving {total_articles} articles (metadata only)…")
        yield _make_status("info", f"Jina disabled — saving {total_articles} articles without content.")
        for article in articles:
            yield _make_status(
                "success",
                f"[{article['source']}] Saved (no content): {article['title'][:60]}",
                data={**article, "content": None},
            )
        print(f"\n{'='*60}")
        print(f"  Pipeline done — {total_articles} articles saved (metadata only)")
        print(f"{'='*60}\n")
        return

    print(f"\n[Phase 3] Fetching content for {total_articles} articles "
          f"({settings.JINA_CONCURRENCY} workers)…\n")
    yield _make_status("info", f"Fetching content for {total_articles} articles…")

    # -----------------------------------------------------------------------
    # Phase 3: fetch Jina content in parallel, bounded by JINA_CONCURRENCY
    # -----------------------------------------------------------------------
    completed = 0
    errors = 0

    with ThreadPoolExecutor(max_workers=settings.JINA_CONCURRENCY) as pool:
        future_to_article = {
            pool.submit(_fetch_jina, a["link"]): a
            for a in articles
        }
        for future in as_completed(future_to_article):
            article = future_to_article[future]
            source = article["source"]
            title = article["title"]
            completed += 1
            content: str | None = None

            try:
                content = future.result()
                chars = len(content) if content else 0
                print(f"  [{completed:>4}/{total_articles}] OK   {source}: {title[:50]} ({chars} chars)")
            except RetryError as exc:
                errors += 1
                print(f"  [{completed:>4}/{total_articles}] FAIL {source}: {title[:50]} — retries exhausted")
                yield _make_status(
                    "error",
                    f"[{source}] Jina AI exhausted retries for {article['link'][:80]}: {exc}",
                )
            except requests.HTTPError as exc:
                errors += 1
                print(f"  [{completed:>4}/{total_articles}] FAIL {source}: {title[:50]} — HTTP {exc}")
                yield _make_status(
                    "error",
                    f"[{source}] Jina AI HTTP error for {article['link'][:80]}: {exc}",
                )
            except Exception as exc:
                errors += 1
                print(f"  [{completed:>4}/{total_articles}] FAIL {source}: {title[:50]} — {exc}")
                yield _make_status(
                    "error",
                    f"[{source}] Unexpected error fetching {article['link'][:80]}: {exc}",
                )

            yield _make_status(
                "success",
                f"[{source}] Scraped: {title[:60]}",
                data={**article, "content": content},
            )

    print(f"\n{'='*60}")
    print(f"  Pipeline done — {total_articles} articles, {errors} Jina errors")
    print(f"{'='*60}\n")
