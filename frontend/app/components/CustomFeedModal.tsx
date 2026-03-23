"use client";

import { useEffect, useRef, useState } from "react";
import { scrapeCustomFeed } from "@/app/lib/api";
import { getCustomFeeds, addCustomFeed, removeCustomFeed } from "@/app/lib/customFeeds";
import type { CustomFeed } from "@/app/lib/customFeeds";

interface CustomFeedModalProps {
  categories: string[];
  onClose: () => void;
  onFeedAdded: () => void; // trigger re-fetch in parent
}

type Status = "idle" | "loading" | "done" | "error";

export default function CustomFeedModal({ categories, onClose, onFeedAdded }: CustomFeedModalProps) {
  const [url,      setUrl]      = useState("");
  const [source,   setSource]   = useState("");
  const [category, setCategory] = useState(categories[0] ?? "");
  const [status,   setStatus]   = useState<Status>("idle");
  const [message,  setMessage]  = useState("");
  const [feeds,    setFeeds]    = useState<CustomFeed[]>([]);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFeeds(getCustomFeeds());
    urlRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleAdd() {
    const trimUrl    = url.trim();
    const trimSource = source.trim();
    if (!trimUrl || !trimSource || !category) return;

    setStatus("loading");
    setMessage("");
    try {
      addCustomFeed({ url: trimUrl, source: trimSource, category });
      const result = await scrapeCustomFeed(trimUrl, trimSource, category);
      setFeeds(getCustomFeeds());
      setMessage(`Done — ${result.saved} new articles saved`);
      setStatus("done");
      setUrl("");
      setSource("");
      onFeedAdded();
    } catch {
      setMessage("Failed to scrape feed. Check the URL and try again.");
      setStatus("error");
    }
  }

  function handleRemove(feedUrl: string) {
    removeCustomFeed(feedUrl);
    setFeeds(getCustomFeeds());
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>
      {/* ── Header ───────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-8 border-b"
        style={{ borderColor: "var(--border)", height: "57px" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-faint)", flexShrink: 0 }}>
          <path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" />
        </svg>
        <span
          className="flex-1 text-[10px] font-semibold tracking-[0.22em] uppercase"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-muted)" }}
        >
          Custom Feeds
        </span>
        <button
          onClick={onClose}
          className="text-[9px] font-semibold tracking-[0.18em] uppercase hover:opacity-70 transition-opacity"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
        >
          esc
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-8">

          {/* ── Add form ─────────────────────────────────────────── */}
          <div className="mb-10">
            <p
              className="text-[9px] font-semibold tracking-[0.25em] uppercase mb-5"
              style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
            >
              Add a feed
            </p>

            <div className="flex flex-col gap-3">
              {/* URL */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] tracking-[0.15em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
                  RSS / Atom URL
                </label>
                <input
                  ref={urlRef}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/feed.xml"
                  className="w-full px-4 py-2.5 border bg-transparent outline-none text-sm"
                  style={{
                    borderColor: "var(--border-hover)",
                    color: "var(--text-primary)",
                    fontFamily: "Cormorant, Georgia, serif",
                    fontStyle: "italic",
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                />
              </div>

              {/* Source name + category in a row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] tracking-[0.15em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
                    Source name
                  </label>
                  <input
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="My Blog"
                    className="w-full px-4 py-2.5 border bg-transparent outline-none text-sm"
                    style={{
                      borderColor: "var(--border-hover)",
                      color: "var(--text-primary)",
                      fontFamily: "Syne, sans-serif",
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] tracking-[0.15em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 border bg-transparent outline-none text-sm"
                    style={{
                      borderColor: "var(--border-hover)",
                      color: "var(--text-primary)",
                      fontFamily: "Syne, sans-serif",
                      background: "var(--bg-base)",
                    }}
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat} style={{ background: "var(--bg-base)" }}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center gap-4 mt-1">
                <button
                  onClick={handleAdd}
                  disabled={status === "loading" || !url.trim() || !source.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 border text-[9px] font-semibold tracking-[0.18em] uppercase transition-all duration-200 disabled:opacity-40"
                  style={{
                    fontFamily: "Syne, sans-serif",
                    borderColor: "var(--accent-border)",
                    color: "var(--accent)",
                    background: "var(--accent-dim)",
                  }}
                >
                  {status === "loading" && (
                    <span className="w-3 h-3 rounded-full border border-t-transparent animate-spin inline-block" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
                  )}
                  {status === "loading" ? "Scraping…" : "Add & Scrape"}
                </button>

                {message && (
                  <p
                    className="text-[9px] tracking-wide"
                    style={{
                      fontFamily: "Syne, sans-serif",
                      color: status === "error" ? "#ff6b6b" : "var(--accent)",
                    }}
                  >
                    {message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Saved feeds ──────────────────────────────────────── */}
          {feeds.length > 0 && (
            <div>
              <p
                className="text-[9px] font-semibold tracking-[0.25em] uppercase mb-4"
                style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
              >
                Your custom feeds
              </p>
              <div className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
                {feeds.map((feed) => (
                  <div
                    key={feed.url}
                    className="flex items-start gap-4 py-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[9px] font-semibold tracking-[0.15em] uppercase"
                          style={{ fontFamily: "Syne, sans-serif", color: "var(--accent)" }}
                        >
                          {feed.source}
                        </span>
                        <span style={{ color: "var(--text-faint)", fontSize: "8px" }}>·</span>
                        <span
                          className="text-[9px] tracking-wide"
                          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
                        >
                          {feed.category}
                        </span>
                      </div>
                      <p
                        className="text-xs truncate"
                        style={{ color: "var(--text-faint)", fontFamily: "monospace" }}
                      >
                        {feed.url}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemove(feed.url)}
                      className="shrink-0 text-[9px] font-semibold tracking-[0.15em] uppercase hover:opacity-60 transition-opacity mt-0.5"
                      style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {feeds.length === 0 && (
            <p
              className="text-[9px] tracking-[0.15em] uppercase"
              style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
            >
              No custom feeds added yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
