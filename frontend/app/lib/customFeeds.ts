"use client";

const KEY = "newsagg_custom_feeds";

export interface CustomFeed {
  url: string;
  source: string;
  category: string;
  addedAt: string; // ISO string
}

export function getCustomFeeds(): CustomFeed[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addCustomFeed(feed: Omit<CustomFeed, "addedAt">): CustomFeed {
  const entry: CustomFeed = { ...feed, addedAt: new Date().toISOString() };
  const current = getCustomFeeds().filter((f) => f.url !== feed.url);
  localStorage.setItem(KEY, JSON.stringify([entry, ...current]));
  return entry;
}

export function removeCustomFeed(url: string): void {
  const updated = getCustomFeeds().filter((f) => f.url !== url);
  localStorage.setItem(KEY, JSON.stringify(updated));
}
