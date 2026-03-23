"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getBookmarks, toggleBookmark } from "@/app/lib/bookmarks";
import type { Article } from "@/app/types";

interface FilterCallbacks {
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

export default function BookmarksView({ onCategoryClick, onSourceClick }: FilterCallbacks) {
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    setArticles(getBookmarks());
    const handler = () => setArticles(getBookmarks());
    window.addEventListener("bookmarks-changed", handler);
    return () => window.removeEventListener("bookmarks-changed", handler);
  }, []);

  return (
    <div>
      {/* Header */}
      <div
        className="px-8 py-4 border-b flex items-center gap-4"
        style={{ borderColor: "var(--border)" }}
      >
        <span
          className="text-[9px] font-semibold tracking-[0.28em] uppercase"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
        >
          Bookmarks
        </span>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        {articles.length > 0 && (
          <span
            className="text-[9px] tracking-wide"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
          >
            {articles.length} saved
          </span>
        )}
      </div>

      {/* Empty state */}
      {articles.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-faint)" }}>
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <p className="text-[10px] tracking-[0.2em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
            No bookmarks yet
          </p>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            Click the bookmark icon on any article to save it here.
          </p>
        </div>
      )}

      {/* Article list */}
      {articles.length > 0 && (
        <div className="max-w-4xl mx-auto px-8 py-6">
          {articles.map((article, idx) => (
            <motion.a
              key={article.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.4) }}
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-5 py-5 border-b hover:bg-white/[0.02] transition-colors duration-150"
              style={{ borderColor: "var(--border)" }}
            >
              {/* Date stamp */}
              <div className="shrink-0 w-14 pt-0.5 text-right">
                {article.pub_date && (
                  <time className="text-[9px]" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
                    {new Date(article.pub_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </time>
                )}
              </div>
              <div className="shrink-0 w-px self-stretch" style={{ background: "var(--border)" }} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <button
                    onClick={(e) => { e.preventDefault(); onCategoryClick(article.category); }}
                    className="text-[9px] font-semibold tracking-[0.18em] uppercase hover:opacity-70 transition-opacity"
                    style={{ fontFamily: "Syne, sans-serif", color: "var(--accent)" }}
                  >
                    {article.category}
                  </button>
                  <span style={{ color: "var(--text-faint)", fontSize: "8px" }}>·</span>
                  <button
                    onClick={(e) => { e.preventDefault(); onSourceClick(article.source); }}
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
                <h3
                  className="font-bold italic leading-snug text-xl sm:text-2xl group-hover:opacity-65 transition-opacity duration-200 line-clamp-2"
                  style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}
                >
                  {article.title}
                </h3>
                {article.snippet && (
                  <p className="mt-1.5 text-sm leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>
                    {article.snippet}
                  </p>
                )}
              </div>

              {/* Remove bookmark */}
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleBookmark(article); }}
                aria-label="Remove bookmark"
                className="shrink-0 mt-1 hover:opacity-60 transition-opacity"
                style={{ color: "var(--accent)" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </button>
            </motion.a>
          ))}
        </div>
      )}
    </div>
  );
}
