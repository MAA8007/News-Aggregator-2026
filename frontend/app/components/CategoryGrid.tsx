"use client";

import { motion } from "framer-motion";
import type { Article } from "@/app/types";
import NewsCard from "./NewsCard";
import BookmarkButton from "@/app/components/BookmarkButton";

interface FilterCallbacks {
  onCategoryClick: (cat: string) => void;
  onSourceClick: (src: string) => void;
}

interface CategoryGridProps extends FilterCallbacks {
  articles: Article[];
  label: string; // category or source name shown in the section header
}

const NON_IMAGE_EXTS = /\.(mp4|mp3|webm|ogg|wav|mov|avi|mkv|flac|m4a|m4v|gif)(\?.*)?$/i;
function isValidImageUrl(url: string | null): url is string {
  if (!url) return false;
  if (!url.startsWith("https://")) return false;
  if (NON_IMAGE_EXTS.test(url)) return false;
  return true;
}

function relativeTime(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
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

/* ── Side panel row (right of hero) ───────────────────────────────── */
function SidePanelRow({
  article,
  onCategoryClick,
  onSourceClick,
}: { article: Article } & FilterCallbacks) {
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col flex-1 px-6 py-5 border-b hover:bg-white/[0.025] transition-colors duration-150"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Meta */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={(e) => { e.preventDefault(); onCategoryClick(article.category); }}
          className="text-[9px] font-semibold tracking-[0.18em] uppercase hover:opacity-70 transition-opacity"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--accent)" }}
        >
          {article.category}
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
        className="font-bold italic leading-snug text-xl sm:text-2xl group-hover:opacity-65 transition-opacity duration-200 line-clamp-3"
        style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}
      >
        {article.title}
      </h3>

      {/* Snippet */}
      {article.snippet && (
        <p className="mt-2 text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>
          {article.snippet}
        </p>
      )}

      {/* Footer */}
      <div className="mt-auto pt-3 flex items-center justify-between">
        <button
          onClick={(e) => { e.preventDefault(); onSourceClick(article.source); }}
          className="text-[9px] font-semibold tracking-widest uppercase hover:opacity-70 transition-opacity"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
        >
          {article.source}
        </button>
        <div className="flex items-center gap-2">
          <BookmarkButton article={article} />
          <span className="text-xs group-hover:translate-x-1 transition-transform duration-200" style={{ color: "var(--text-faint)" }}>→</span>
        </div>
      </div>
    </a>
  );
}

/* ── "More Stories" list row (Economist/NYT latest style) ─────────── */
function StoryRow({
  article,
  index,
  onCategoryClick,
  onSourceClick,
}: { article: Article; index: number } & FilterCallbacks) {
  return (
    <motion.a
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.35) }}
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-5 py-5 pr-4 border-b hover:bg-white/[0.02] transition-colors duration-150"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Date stamp */}
      <div className="shrink-0 w-14 pt-0.5 text-right">
        {article.pub_date && (
          <time
            className="text-[9px] leading-tight"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
          >
            {new Date(article.pub_date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </time>
        )}
      </div>

      {/* Divider */}
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

        <button
          onClick={(e) => { e.preventDefault(); onSourceClick(article.source); }}
          className="mt-2 text-[9px] font-semibold tracking-widest uppercase hover:opacity-70 transition-opacity"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
        >
          {article.source}
        </button>
      </div>

      {/* Arrow + bookmark */}
      <div className="shrink-0 flex items-center gap-2 mt-1">
        <BookmarkButton article={article} />
        <span className="text-sm group-hover:translate-x-1 transition-transform duration-200" style={{ color: "var(--text-faint)" }}>→</span>
      </div>
    </motion.a>
  );
}

/* ── Main export ─────────────────────────────────────────────────── */
export default function CategoryGrid({
  articles,
  label,
  onCategoryClick,
  onSourceClick,
}: CategoryGridProps) {
  if (articles.length === 0) return null;

  // Find best image article for hero
  const heroIdx    = articles.findIndex((a) => isValidImageUrl(a.image_url));
  const heroHasImg = heroIdx >= 0;

  // Only build hero layout when there's an image
  const hero       = heroHasImg ? articles[heroIdx] : null;
  const afterHero  = heroHasImg ? articles.filter((_, i) => i !== heroIdx) : articles;

  const panel      = heroHasImg ? afterHero.slice(0, 3) : [];
  const afterPanel = heroHasImg ? afterHero.slice(3) : afterHero;

  // Image strip: image articles only (up to 8, 4 per row)
  const strip    = afterPanel.filter((a) => isValidImageUrl(a.image_url)).slice(0, 8);
  const stripIds = new Set(strip.map((a) => a.id));

  // Text feed: everything that didn't make the strip
  const textFeed  = afterPanel.filter((a) => !stripIds.has(a.id));
  const stripCols = Math.min(strip.length, 4);

  return (
    <div>
      {/* ── Category header ──────────────────────────────────────── */}
      <div
        className="px-8 py-4 border-b flex items-center gap-4"
        style={{ borderColor: "var(--border)" }}
      >
        <span
          className="text-[9px] font-semibold tracking-[0.28em] uppercase"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
        >
          {label}
        </span>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>

      {/* ── Hero + side panel (only when an image exists) ────────── */}
      {heroHasImg && hero && (
        <div
          className="grid grid-cols-1 lg:grid-cols-[1fr_380px] border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="relative h-[460px] sm:h-[540px] border-r"
            style={{ borderColor: "var(--border)" }}
          >
            <NewsCard
              article={hero}
              isHero
              index={0}
              priority
              onCategoryClick={onCategoryClick}
              onSourceClick={onSourceClick}
            />
          </div>

          <div className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
            {panel.map((article) => (
              <SidePanelRow
                key={article.id}
                article={article}
                onCategoryClick={onCategoryClick}
                onSourceClick={onSourceClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Image strip ──────────────────────────────────────────── */}
      {strip.length > 0 && (
        <div
          className="grid border-b"
          style={{
            gridTemplateColumns: `repeat(${stripCols}, 1fr)`,
            borderColor: "var(--border)",
          }}
        >
          {strip.map((article, idx) => (
            <div
              key={article.id}
              className="relative h-[220px] border-r last:border-r-0"
              style={{ borderColor: "var(--border)" }}
            >
              <NewsCard
                article={article}
                index={idx + 4}
                onCategoryClick={onCategoryClick}
                onSourceClick={onSourceClick}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── More stories text list ────────────────────────────────── */}
      {textFeed.length > 0 && (
        <div className="max-w-4xl mx-auto px-8 pt-8 pb-4">
          <div className="flex items-center gap-5 mb-2">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span
              className="text-[9px] font-semibold tracking-[0.28em] uppercase"
              style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
            >
              More Stories
            </span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>
          {textFeed.map((article, idx) => (
            <StoryRow
              key={article.id}
              article={article}
              index={idx}
              onCategoryClick={onCategoryClick}
              onSourceClick={onSourceClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
