"use client";

import { useState, useEffect } from "react";
import type { Article } from "@/app/types";

const KEY = "newsagg_bookmarks";

export function getBookmarks(): Article[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function isBookmarked(articleId: number): boolean {
  return getBookmarks().some((a) => a.id === articleId);
}

export function toggleBookmark(article: Article): boolean {
  const current = getBookmarks();
  const exists   = current.some((a) => a.id === article.id);
  if (exists) {
    localStorage.setItem(KEY, JSON.stringify(current.filter((a) => a.id !== article.id)));
  } else {
    localStorage.setItem(KEY, JSON.stringify([article, ...current]));
  }
  window.dispatchEvent(new Event("bookmarks-changed"));
  return !exists;
}

/** Use inside a card to get saved state + toggle handler. */
export function useBookmark(article: Article) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isBookmarked(article.id));
    const handler = () => setSaved(isBookmarked(article.id));
    window.addEventListener("bookmarks-changed", handler);
    return () => window.removeEventListener("bookmarks-changed", handler);
  }, [article.id]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSaved(toggleBookmark(article));
  }

  return { saved, toggle };
}

/** Use in the sidebar to get a live bookmark count. */
export function useBookmarkCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(getBookmarks().length);
    const handler = () => setCount(getBookmarks().length);
    window.addEventListener("bookmarks-changed", handler);
    return () => window.removeEventListener("bookmarks-changed", handler);
  }, []);

  return count;
}
