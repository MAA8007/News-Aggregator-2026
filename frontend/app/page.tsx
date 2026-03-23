"use client";

import { useEffect, useRef, useState } from "react";

import Sidebar         from "@/app/components/SideBar";
import Header          from "@/app/components/Header";
import AuthModal       from "@/app/components/AuthModal";
import { AuthProvider, useAuth } from "@/app/contexts/AuthContext";
import HomeGrid        from "@/app/components/HomeGrid";
import CategoryGrid    from "@/app/components/CategoryGrid";
import SkeletonGrid    from "@/app/components/SkeletonGrid";
import BookmarksView   from "@/app/components/BookmarksView";
import MoviesPage      from "@/app/components/MoviesPage";
import BooksPage       from "@/app/components/BooksPage";
import SportsPage      from "@/app/components/SportsPage";
import CustomFeedModal from "@/app/components/CustomFeedModal";
import { fetchFilters, fetchNews, fetchSections } from "@/app/lib/api";
import type { Article, Filters, Sections } from "@/app/types";

const PAGE_SIZE = 12;

function AppContent() {
  const { authModalOpen } = useAuth();
  const [articles,       setArticles]       = useState<Article[]>([]);
  const [total,          setTotal]          = useState(0);
  const [page,           setPage]           = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [category,       setCategory]       = useState<string | null>(null);
  const [source,         setSource]         = useState<string | null>(null);
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [filters,        setFilters]        = useState<Filters>({
    categories: [],
    sources: [],
    source_categories: {},
    category_counts: {},
    source_counts: {},
  });
  const [sections,       setSections]       = useState<Sections>({});
  const [refreshKey,     setRefreshKey]     = useState(0);
  const [view,           setView]           = useState<"feed" | "bookmarks" | "movies" | "books" | "sports">("feed");
  const [customFeedsOpen, setCustomFeedsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Load filters once
  useEffect(() => {
    fetchFilters().then(setFilters).catch(() => {});
  }, []);

  // Fetch sections for home view whenever filters load or filter state resets
  const filtersLoaded = filters.categories.length > 0;
  useEffect(() => {
    if (category || source) { setSections({}); return; }
    if (!filtersLoaded) return;
    const allCats = Object.keys(filters.category_counts);
    fetchSections(allCats, 6).then(setSections).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, source, filtersLoaded]);

  // Reset and fetch page 1 when filters change or a scrape completes
  useEffect(() => {
    let active = true;
    setInitialLoading(true);
    setError(null);
    setPage(1);

    fetchNews({ page: 1, pageSize: PAGE_SIZE, category, source })
      .then((data) => {
        if (!active) return;
        setArticles(data.items);
        setTotal(data.total);
        setInitialLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("Could not reach the API. Is the backend running on port 8000?");
        setInitialLoading(false);
      });

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, source, refreshKey]);

  // Fetch additional pages
  useEffect(() => {
    if (page === 1) return;
    let active = true;
    setLoadingMore(true);

    fetchNews({ page, pageSize: PAGE_SIZE, category, source })
      .then((data) => {
        if (!active) return;
        setArticles((prev) => [...prev, ...data.items]);
        setTotal(data.total);
        setLoadingMore(false);
      })
      .catch(() => { if (!active) return; setLoadingMore(false); });

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const hasMore = articles.length < total;

  // Infinite scroll — trigger next page when sentinel enters viewport
  useEffect(() => {
    if (!hasMore || loadingMore || initialLoading) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setPage((p) => p + 1); },
      { rootMargin: "300px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, initialLoading]);

  return (
    <div className="flex min-h-screen">

      {/* ── Sidebar ──────────────────────────────── */}
      <Sidebar
        filters={filters}
        activeCategory={category}
        activeSource={source}
        activeView={view}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCategoryChange={(cat) => { setCategory(cat); setView("feed"); setSidebarOpen(false); }}
        onSourceChange={(src) => { setSource(src); setView("feed"); setSidebarOpen(false); }}
        onBookmarksClick={() => { setView(view === "bookmarks" ? "feed" : "bookmarks"); setSidebarOpen(false); }}
        onCustomFeedsClick={() => { setCustomFeedsOpen(true); setSidebarOpen(false); }}
        onMoviesClick={() => { setView(view === "movies" ? "feed" : "movies"); setSidebarOpen(false); }}
        onBooksClick={() => { setView(view === "books" ? "feed" : "books"); setSidebarOpen(false); }}
        onSportsClick={() => { setView(view === "sports" ? "feed" : "sports"); setSidebarOpen(false); }}
      />

      {/* ── Main content ─────────────────────────── */}
      <main className="flex-1 min-w-0 md:ml-[220px]">

        <Header
          total={total}
          activeCategory={category}
          activeSource={source}
          onClearCategory={() => setCategory(null)}
          onClearSource={() => setSource(null)}
          onCategoryClick={(cat) => { setCategory(cat); setSource(null); }}
          onSourceClick={(src) => { setSource(src); }}
          onScrapeComplete={() => setRefreshKey((k) => k + 1)}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Movies view */}
        {view === "movies" && <MoviesPage />}

        {/* Books view */}
        {view === "books" && <BooksPage />}

        {/* Sports view */}
        {view === "sports" && <SportsPage />}

        {/* Bookmarks view */}
        {view === "bookmarks" && (
          <BookmarksView
            onCategoryClick={(cat) => { setCategory(cat); setSource(null); setView("feed"); }}
            onSourceClick={(src) => { setSource(src); setView("feed"); }}
          />
        )}

        {/* Error */}
        {view === "feed" && error && (
          <div className="flex items-center justify-center min-h-[60vh] px-8">
            <div className="border p-10 text-center max-w-md" style={{ borderColor: "var(--border)" }}>
              <p className="font-semibold mb-2 text-sm" style={{ fontFamily: "Syne, sans-serif", color: "#ff6b6b" }}>
                Connection error
              </p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{error}</p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {view === "feed" && !error && initialLoading && (
          <div className="p-8">
            <SkeletonGrid count={8} />
          </div>
        )}

        {/* Empty state */}
        {view === "feed" && !error && !initialLoading && articles.length === 0 && (
          <div className="flex items-center justify-center min-h-[60vh] px-8">
            <div className="border p-10 text-center max-w-md" style={{ borderColor: "var(--border)" }}>
              <p className="font-semibold mb-2 text-sm" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-primary)" }}>
                No articles yet
              </p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Trigger a scrape via{" "}
                <code className="px-1.5 py-0.5 text-xs" style={{ background: "rgba(255,255,255,0.07)", color: "var(--accent)", fontFamily: "monospace" }}>
                  POST /api/scrape
                </code>{" "}
                to populate the feed.
              </p>
            </div>
          </div>
        )}

        {/* Articles + infinite scroll */}
        {view === "feed" && !error && !initialLoading && articles.length > 0 && (
          <div key={refreshKey} className="feed-refresh">
            {(category || source) ? (
              <CategoryGrid
                articles={articles}
                label={source ?? category ?? ""}
                onCategoryClick={(cat) => { setCategory(cat); setSource(null); }}
                onSourceClick={(src) => { setSource(src); }}
              />
            ) : (
              <HomeGrid
                articles={articles}
                sections={sections}
                onCategoryClick={(cat: string) => { setCategory(cat); setSource(null); }}
                onSourceClick={(src: string) => { setSource(src); }}
              />
            )}

            {/* Sentinel + loading indicator */}
            <div ref={sentinelRef} className="flex items-center justify-center py-12">
              {loadingMore && (
                <span
                  className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "var(--text-faint)", borderTopColor: "transparent" }}
                />
              )}
              {!hasMore && !loadingMore && (
                <p
                  className="text-xs tracking-[0.15em] uppercase"
                  style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
                >
                  End of feed · {total} articles total
                </p>
              )}
            </div>
          </div>
        )}
      </main>
      {customFeedsOpen && (
        <CustomFeedModal
          categories={filters.categories}
          onClose={() => setCustomFeedsOpen(false)}
          onFeedAdded={() => setRefreshKey((k) => k + 1)}
        />
      )}
      {authModalOpen && <AuthModal />}
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
