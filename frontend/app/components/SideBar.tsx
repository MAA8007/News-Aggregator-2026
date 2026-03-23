"use client";

import { useEffect, useState } from "react";
import type { Filters } from "@/app/types";
import { useBookmarkCount } from "@/app/lib/bookmarks";

interface CategoryGroup {
  label: string;
  sources: string[];
}

function buildCategoryGroups(
  sources: string[],
  sourceCats: Record<string, string[]>
): CategoryGroup[] {
  const groups: Record<string, string[]> = {};
  for (const src of sources) {
    for (const cat of sourceCats[src] ?? []) {
      (groups[cat] ??= []).push(src);
    }
  }
  return Object.entries(groups)
    .map(([label, srcs]) => ({ label, sources: srcs.sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const CATEGORY_ICONS: Record<string, string> = {
  "Artificial Intelligence": "◈",
  "Technology":              "⊗",
  "Science & Space":         "◎",
  "Business & Finance":      "◉",
  "World News":              "◒",
  "Politics & Policy":       "◐",
  "Culture & Society":       "◕",
  "Pakistan":                "◔",
  "Sports":                  "◑",
  "Football":                "⊕",
  "Liverpool FC":            "◓",
  "Formula 1":               "⊛",
};

interface SidebarProps {
  filters: Filters;
  activeCategory: string | null;
  activeSource: string | null;
  activeView: "feed" | "bookmarks";
  onCategoryChange: (cat: string | null) => void;
  onSourceChange:   (src: string | null) => void;
  onBookmarksClick: () => void;
  onCustomFeedsClick: () => void;
}

export default function Sidebar({
  filters,
  activeCategory,
  activeSource,
  activeView,
  onCategoryChange,
  onSourceChange,
  onBookmarksClick,
  onCustomFeedsClick,
}: SidebarProps) {
  const bookmarkCount = useBookmarkCount();
  const categoryGroups = buildCategoryGroups(filters.sources, filters.source_categories);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  // Auto-expand the relevant group when a category filter is set
  useEffect(() => {
    if (activeCategory) {
      setOpenGroups((prev) => {
        if (prev.has(activeCategory)) return prev;
        const next = new Set(prev);
        next.add(activeCategory);
        return next;
      });
    }
  }, [activeCategory]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  const hasFilter = activeCategory !== null || activeSource !== null;

  return (
    <aside
      className="fixed top-0 left-0 h-screen w-[220px] flex flex-col z-40 border-r"
      style={{ backgroundColor: "var(--bg-sidebar)", borderColor: "var(--border)" }}
    >
      {/* ── Logo ─────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-5 border-b" style={{ borderColor: "var(--border)" }}>
        <h1
          className="text-2xl font-bold italic leading-none"
          style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}
        >
          News
        </h1>
        {/* <span
          className="block mt-1 text-[9px] font-semibold tracking-[0.25em] not-italic"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
        >
          2026
        </span> */}
      </div>

      {/* ── Active filter chips ───────────────────────── */}
      {hasFilter && (
        <div
          className="px-3 py-2.5 border-b flex flex-col gap-1"
          style={{ borderColor: "var(--border)" }}
        >
          {activeCategory && (
            <button
              onClick={() => onCategoryChange(null)}
              className="flex items-center gap-2 w-full text-left px-2 py-1 rounded-sm transition-colors duration-150"
              style={{ background: "var(--accent-dim)" }}
            >
              <span className="text-[10px]" style={{ color: "var(--accent)" }}>
                {CATEGORY_ICONS[activeCategory] ?? "◇"}
              </span>
              <span
                className="flex-1 text-[9px] font-semibold tracking-[0.12em] uppercase truncate"
                style={{ fontFamily: "Syne, sans-serif", color: "var(--accent)" }}
              >
                {activeCategory}
              </span>
              <span className="text-[9px] shrink-0" style={{ color: "var(--accent)" }}>✕</span>
            </button>
          )}
          {activeSource && (
            <button
              onClick={() => onSourceChange(null)}
              className="flex items-center gap-2 w-full text-left px-2 py-1 rounded-sm transition-colors duration-150"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-hover)" }}
            >
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>◇</span>
              <span
                className="flex-1 text-[9px] font-semibold tracking-[0.12em] uppercase truncate"
                style={{ fontFamily: "Syne, sans-serif", color: "var(--text-primary)" }}
              >
                {activeSource}
              </span>
              <span className="text-[9px] shrink-0" style={{ color: "var(--text-faint)" }}>✕</span>
            </button>
          )}
        </div>
      )}

      {/* ── Nav ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 pt-4 pb-4">

        {/* All Articles */}
        <button
          onClick={() => { onCategoryChange(null); onSourceChange(null); }}
          className={`nav-item ${!hasFilter ? "nav-item-active" : ""}`}
        >
          <span className="text-[11px]">◈</span>
          <span className="flex-1 text-left">All Articles</span>
        </button>

        {/* Unified category + source hierarchy */}
        <div className="mt-2">
          {categoryGroups.map((group) => {
            const isOpen = openGroups.has(group.label);
            const isCatActive = activeCategory === group.label;
            const hasActiveSource = activeSource !== null && group.sources.includes(activeSource);
            const count = filters.category_counts[group.label];

            return (
              <div key={group.label}>
                {/* Category row: left = filter button, right = expand toggle */}
                <div className="flex items-center mt-0.5">
                  <button
                    onClick={() => {
                      onCategoryChange(isCatActive ? null : group.label);
                      if (!isOpen) toggleGroup(group.label);
                    }}
                    className={`nav-item flex-1 min-w-0 ${isCatActive ? "nav-item-active" : ""}`}
                    style={
                      hasActiveSource && !isCatActive
                        ? { color: "var(--accent)" }
                        : undefined
                    }
                  >
                    <span className="text-[11px] shrink-0">
                      {CATEGORY_ICONS[group.label] ?? "◇"}
                    </span>
                    <span className="flex-1 truncate text-left">{group.label}</span>
                    {count !== undefined && (
                      <span
                        className="text-[9px] shrink-0 ml-1"
                        style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                  {/* Separate expand-only toggle */}
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="shrink-0 px-1.5 py-2"
                    style={{ color: "var(--text-faint)" }}
                  >
                    <span
                      className="text-[8px] inline-block transition-transform duration-220"
                      style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    >
                      ▾
                    </span>
                  </button>
                </div>

                {/* Fluid accordion */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateRows: isOpen ? "1fr" : "0fr",
                    transition: "grid-template-rows 0.22s ease",
                  }}
                >
                  <div style={{ overflow: "hidden" }}>
                    <div className="pl-3 pb-1">
                      {group.sources.map((src) => {
                        const srcCount = filters.source_counts[src];
                        return (
                          <button
                            key={src}
                            onClick={() => onSourceChange(activeSource === src ? null : src)}
                            className={`nav-item ${activeSource === src ? "nav-item-active" : ""}`}
                          >
                            <span className="text-[11px] shrink-0">◇</span>
                            <span className="flex-1 truncate text-left">{src}</span>
                            {srcCount !== undefined && (
                              <span
                                className="text-[9px] shrink-0 ml-1"
                                style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
                              >
                                {srcCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Library section */}
        <p
          className="px-3 mt-7 mb-2 text-[9px] font-semibold tracking-[0.25em] uppercase"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
        >
          Library
        </p>
        <button
          onClick={onBookmarksClick}
          className={`nav-item ${activeView === "bookmarks" ? "nav-item-active" : ""}`}
        >
          <span className="text-[11px]">◻</span>
          <span className="flex-1 text-left">Bookmarks</span>
          {bookmarkCount > 0 && (
            <span
              className="text-[9px] shrink-0"
              style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
            >
              {bookmarkCount}
            </span>
          )}
        </button>
        <button
          onClick={onCustomFeedsClick}
          className="nav-item"
        >
          <span className="text-[11px]">⊕</span>
          <span className="flex-1 text-left">Custom Feeds</span>
        </button>
      </div>

      {/* ── User ─────────────────────────────────────── */}
      {/* <div
        className="px-4 py-4 border-t flex items-center gap-2.5"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: "var(--accent)", color: "#000" }}
        >
          A
        </div>
        <div className="min-w-0">
          <p
            className="text-xs font-semibold truncate"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-primary)" }}
          >
            Admin
          </p>
          <p
            className="text-[9px] tracking-widest uppercase"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
          >
            Member
          </p>
        </div>
      </div> */}
    </aside>
  );
}