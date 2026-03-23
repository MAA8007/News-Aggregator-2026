"use client";

import { useEffect, useState } from "react";
import ThemeToggle from "@/app/components/ThemeToggle";
import SearchModal from "@/app/components/SearchModal";
import { triggerScrape } from "@/app/lib/api";

interface HeaderProps {
  total: number;
  activeCategory: string | null;
  activeSource: string | null;
  onClearCategory: () => void;
  onClearSource: () => void;
  onCategoryClick: (cat: string) => void;
  onSourceClick: (src: string) => void;
  onScrapeComplete: () => void;
  onMenuClick: () => void;
}

type ScrapeState = "idle" | "running" | "done" | "error";

export default function Header({
  total,
  activeCategory,
  activeSource,
  onClearCategory,
  onClearSource,
  onCategoryClick,
  onSourceClick,
  onScrapeComplete,
  onMenuClick,
}: HeaderProps) {
  const [searchOpen, setSearchOpen]   = useState(false);
  const [scrapeState, setScrapeState] = useState<ScrapeState>("idle");
  const [scrapeMsg, setScrapeMsg]     = useState("");

  // ⌘K / Ctrl+K to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function handleScrape() {
    if (scrapeState === "running") return;
    setScrapeState("running");
    try {
      const result = await triggerScrape();
      setScrapeMsg(`${result.saved} new`);
      setScrapeState("done");
      onScrapeComplete();
      setTimeout(() => setScrapeState("idle"), 4000);
    } catch {
      setScrapeMsg("failed");
      setScrapeState("error");
      setTimeout(() => setScrapeState("idle"), 3000);
    }
  }

  const hasFilter = !!(activeCategory || activeSource);

  return (
    <>
      <div
        className="flex items-center gap-4 px-8 border-b"
        style={{ borderColor: "var(--border)", height: "57px" }}
      >
        {/* ── Left: hamburger (mobile) + scrape ───────────────────── */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden flex items-center justify-center w-8 h-8 transition-opacity hover:opacity-60"
            onClick={onMenuClick}
            aria-label="Open menu"
            style={{ color: "var(--text-faint)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          {/* <div className="live-badge">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse-dot inline-block shrink-0"
              style={{ backgroundColor: "var(--accent)" }}
            />
            Live
          </div> */}

          {/* Scrape button */}
          <button
            onClick={handleScrape}
            disabled={scrapeState === "running"}
            title="Fetch latest articles"
            className="flex items-center gap-1.5 transition-opacity duration-150 hover:opacity-60 disabled:opacity-40"
            style={{ color: scrapeState === "error" ? "#ff6b6b" : scrapeState === "done" ? "var(--accent)" : "var(--text-faint)" }}
          >
            {scrapeState === "running" ? (
              <span
                className="w-3 h-3 rounded-full border border-t-transparent animate-spin inline-block"
                style={{ borderColor: "var(--text-faint)", borderTopColor: "transparent" }}
              />
            ) : (
              /* Refresh icon */
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
            )}
            {(scrapeState === "done" || scrapeState === "error") && (
              <span
                className="text-[9px] font-semibold tracking-[0.12em]"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                {scrapeMsg}
              </span>
            )}
          </button>
        </div>

        {/* ── Centre: active filter chips ─────────────────────────── */}
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          {!hasFilter && (
            <span
              className="text-[10px] font-semibold tracking-[0.22em] uppercase"
              style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
            >
              All Articles
            </span>
          )}

          {activeCategory && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 border text-[9px] font-semibold tracking-[0.15em] uppercase"
              style={{
                fontFamily: "Syne, sans-serif",
                color: "var(--accent)",
                borderColor: "var(--accent-border)",
                background: "var(--accent-dim)",
              }}
            >
              {activeCategory}
              <button
                onClick={onClearCategory}
                className="hover:opacity-60 transition-opacity leading-none"
                aria-label="Clear category filter"
              >
                ×
              </button>
            </span>
          )}

          {activeSource && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 border text-[9px] font-semibold tracking-[0.15em] uppercase"
              style={{
                fontFamily: "Syne, sans-serif",
                color: "var(--text-muted)",
                borderColor: "var(--border-hover)",
                background: "var(--overlay-active)",
              }}
            >
              {activeSource}
              <button
                onClick={onClearSource}
                className="hover:opacity-60 transition-opacity leading-none"
                aria-label="Clear source filter"
              >
                ×
              </button>
            </span>
          )}
        </div>

        {/* ── Right: search + count + theme ───────────────────────── */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Search button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 border transition-colors duration-150 hover:border-[var(--border-hover)]"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-faint)",
              borderRadius: 0,
            }}
            title="Search articles (⌘K)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span
              className="text-[9px] tracking-[0.15em] uppercase"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              Search
            </span>
            <span
              className="hidden sm:inline text-[8px] tracking-wide opacity-50"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              ⌘K
            </span>
          </button>

          {total > 0 && (
            <span
              className="hidden sm:inline text-[10px] tracking-wide"
              style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
            >
              {total.toLocaleString()} articles
            </span>
          )}

          <ThemeToggle />
        </div>
      </div>

      {/* ── Search modal ────────────────────────────────────────────── */}
      {searchOpen && (
        <SearchModal
          onClose={() => setSearchOpen(false)}
          onCategoryClick={(cat) => { onCategoryClick(cat); setSearchOpen(false); }}
          onSourceClick={(src) => { onSourceClick(src); setSearchOpen(false); }}
        />
      )}
    </>
  );
}
