"use client";

import { useEffect, useRef, useState } from "react";
import { searchNews } from "@/app/lib/api";
import type { Article } from "@/app/types";
import BookmarkButton from "@/app/components/BookmarkButton";

interface SearchModalProps {
  onClose: () => void;
  onCategoryClick: (cat: string) => void;
  onSourceClick: (src: string) => void;
}

function relativeTime(dateStr: string): string {
  const ms    = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(ms / 60_000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins  < 1)   return "just now";
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  === 1) return "yesterday";
  if (days  < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function SearchModal({ onClose, onCategoryClick, onSourceClick }: SearchModalProps) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<Article[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setTotal(0); return; }
    const timer = setTimeout(() => {
      setLoading(true);
      searchNews(q, 1, 30)
        .then((data) => { setResults(data.items); setTotal(data.total); setLoading(false); })
        .catch(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const isEmpty = query.trim().length >= 2 && !loading && results.length === 0;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--bg-base)" }}
    >
      {/* ── Search bar ───────────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-8 border-b"
        style={{ borderColor: "var(--border)", height: "57px" }}
      >
        {/* Search icon */}
        <svg
          width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: "var(--text-faint)", flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>

        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search articles…"
          className="flex-1 bg-transparent outline-none"
          style={{
            fontFamily: "Cormorant, Georgia, serif",
            fontStyle: "italic",
            fontSize: "1.25rem",
            color: "var(--text-primary)",
          }}
        />

        {/* Result count */}
        {total > 0 && !loading && (
          <span
            className="text-[9px] tracking-[0.15em] uppercase shrink-0"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
          >
            {total} result{total !== 1 ? "s" : ""}
          </span>
        )}

        {/* ESC hint */}
        <button
          onClick={onClose}
          className="shrink-0 text-[9px] font-semibold tracking-[0.18em] uppercase hover:opacity-70 transition-opacity"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
        >
          esc
        </button>
      </div>

      {/* ── Results ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <span
              className="w-4 h-4 rounded-full border-2 animate-spin"
              style={{ borderColor: "var(--text-faint)", borderTopColor: "transparent" }}
            />
          </div>
        )}

        {/* Empty */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <p
              className="text-sm tracking-wide"
              style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
            >
              No results for &ldquo;{query.trim()}&rdquo;
            </p>
          </div>
        )}

        {/* Prompt */}
        {!loading && query.trim().length < 2 && (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <p
              className="text-[10px] tracking-[0.2em] uppercase"
              style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
            >
              Type at least 2 characters
            </p>
          </div>
        )}

        {/* Results list */}
        {!loading && results.length > 0 && (
          <div className="max-w-3xl mx-auto px-8 py-4">
            {results.map((article) => (
              <a
                key={article.id}
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="group flex items-start gap-5 py-5 pr-4 border-b hover:bg-white/[0.02] transition-colors duration-150"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex-1 min-w-0">
                  {/* Meta */}
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={(e) => { e.preventDefault(); onCategoryClick(article.category); onClose(); }}
                      className="text-[9px] font-semibold tracking-[0.18em] uppercase hover:opacity-70 transition-opacity"
                      style={{ fontFamily: "Syne, sans-serif", color: "var(--accent)" }}
                    >
                      {article.category}
                    </button>
                    <span style={{ color: "var(--text-faint)", fontSize: "8px" }}>·</span>
                    <button
                      onClick={(e) => { e.preventDefault(); onSourceClick(article.source); onClose(); }}
                      className="text-[9px] font-semibold tracking-widest uppercase hover:opacity-70 transition-opacity"
                      style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
                    >
                      {article.source}
                    </button>
                    {article.pub_date && (
                      <>
                        <span style={{ color: "var(--text-faint)", fontSize: "8px" }}>·</span>
                        <span className="text-[9px]" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
                          {relativeTime(article.pub_date)}
                        </span>
                      </>
                    )}
                    <span style={{ color: "var(--text-faint)", fontSize: "8px" }}>·</span>
                    <span className="text-[9px]" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
                      {article.read_minutes} min
                    </span>
                  </div>

                  {/* Title */}
                  <h3
                    className="font-bold italic leading-snug text-xl sm:text-2xl group-hover:opacity-65 transition-opacity duration-200 line-clamp-2"
                    style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}
                  >
                    {article.title}
                  </h3>

                  {/* Snippet */}
                  {article.snippet && (
                    <p
                      className="mt-1.5 text-sm leading-relaxed line-clamp-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {article.snippet}
                    </p>
                  )}
                </div>

                {/* Bookmark + Arrow */}
                <div className="shrink-0 flex items-center gap-2 mt-1">
                  <BookmarkButton article={article} />
                  <span className="text-sm group-hover:translate-x-1 transition-transform duration-200" style={{ color: "var(--text-faint)" }}>→</span>
                </div>
              </a>
            ))}

            {total > results.length && (
              <p
                className="py-6 text-center text-[9px] tracking-[0.2em] uppercase"
                style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
              >
                Showing 30 of {total} — refine your query to narrow results
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
