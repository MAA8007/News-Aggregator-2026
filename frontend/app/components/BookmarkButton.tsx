"use client";

import { useBookmark } from "@/app/lib/bookmarks";
import type { Article } from "@/app/types";

interface BookmarkButtonProps {
  article: Article;
  /** Use light colours (for dark image backgrounds) */
  dark?: boolean;
}

export default function BookmarkButton({ article, dark = false }: BookmarkButtonProps) {
  const { saved, toggle } = useBookmark(article);
  return (
    <button
      onClick={toggle}
      aria-label={saved ? "Remove bookmark" : "Bookmark article"}
      className="shrink-0 transition-opacity duration-150 hover:opacity-60"
      style={{ color: saved ? "var(--accent)" : dark ? "rgba(255,255,255,0.45)" : "var(--text-faint)" }}
    >
      {saved ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      )}
    </button>
  );
}
