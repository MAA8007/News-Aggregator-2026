"use client";

import { motion } from "framer-motion";
import type { Article } from "@/app/types";
import NewsCard from "./NewsCard";

interface FilterCallbacks {
  onCategoryClick: (cat: string) => void;
  onSourceClick: (src: string) => void;
}

interface NewsGridProps extends FilterCallbacks {
  articles: Article[];
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

/* ── Broadsheet (text-only feed) ────────────────────────────────── */
function BroadsheetRow({
  article,
  index,
  onCategoryClick,
  onSourceClick,
}: { article: Article; index: number } & FilterCallbacks) {
  return (
    <motion.a
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group pb-7 mb-7 border-b block"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        {article.category && (
          <button
            onClick={(e) => { e.preventDefault(); onCategoryClick(article.category); }}
            className="text-[9px] font-semibold tracking-[0.2em] uppercase transition-opacity duration-150 hover:opacity-70"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--accent)" }}
          >
            {article.category}
          </button>
        )}
        {article.pub_date && (
          <>
            <span style={{ color: "var(--text-faint)" }}>·</span>
            <time className="text-[9px]" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
              {relativeTime(article.pub_date)}
            </time>
          </>
        )}
        <span style={{ color: "var(--text-faint)" }}>·</span>
        <span className="text-[9px]" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
          {article.read_minutes} min
        </span>
      </div>

      <h2
        className="font-bold italic text-xl sm:text-2xl leading-snug mb-3 group-hover:opacity-60 transition-opacity duration-200"
        style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}
      >
        {article.title}
      </h2>

      {article.snippet && (
        <p className="text-sm leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>
          {article.snippet}
        </p>
      )}

      <div className="flex items-center justify-between mt-3">
        <button
          onClick={(e) => { e.preventDefault(); onSourceClick(article.source); }}
          className="text-[9px] font-semibold tracking-widest uppercase transition-opacity duration-150 hover:opacity-70"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
        >
          {article.source}
        </button>
        <span className="text-xs group-hover:translate-x-1 transition-transform duration-200" style={{ color: "var(--text-faint)" }}>
          →
        </span>
      </div>
    </motion.a>
  );
}

/* ── Right-side panel card ──────────────────────────────────────── */
function PanelCard({
  article,
  index,
  onCategoryClick,
  onSourceClick,
}: { article: Article; index: number } & FilterCallbacks) {
  return (
    <motion.a
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08 }}
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="panel-card group p-5 block w-full h-full"
    >
      <div className="h-full flex flex-col">
        {/* Meta */}
        <div className="flex items-center justify-between mb-4">
          {article.category && (
            <button
              onClick={(e) => { e.preventDefault(); onCategoryClick(article.category); }}
              className="text-[9px] font-semibold tracking-[0.18em] uppercase transition-opacity duration-150 hover:opacity-70"
              style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
            >
              {article.category}
            </button>
          )}
          {article.pub_date && (
            <time className="text-[9px]" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
              {relativeTime(article.pub_date)}
            </time>
          )}
        </div>

        <h3
          className="font-bold leading-snug text-xl sm:text-2xl mb-3 group-hover:opacity-65 transition-opacity duration-200"
          style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}
        >
          {article.title}
        </h3>

        <div className="mt-auto flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={(e) => { e.preventDefault(); onSourceClick(article.source); }}
            className="text-[9px] font-semibold tracking-widest uppercase transition-opacity duration-150 hover:opacity-70"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
          >
            {article.source}
          </button>
          <span className="text-[9px]" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
            {article.read_minutes} min
          </span>
        </div>
      </div>
    </motion.a>
  );
}

/* ── Editorial layout (has images) ──────────────────────────────── */
function EditorialLayout({ articles, onCategoryClick, onSourceClick }: { articles: Article[] } & FilterCallbacks) {
  // Ensure an image article is always the hero
  const sorted = [...articles];
  const firstImgIdx = sorted.findIndex((a) => isValidImageUrl(a.image_url));
  if (firstImgIdx > 0) {
    [sorted[0], sorted[firstImgIdx]] = [sorted[firstImgIdx], sorted[0]];
  }

  const hero     = sorted[0];
  const panel1   = sorted[1];
  const panel2   = sorted[2];
  const feedRest = sorted.slice(3);

  return (
    <div>
      {/* ── Top: Hero + right panel ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] border-b" style={{ borderColor: "var(--border)" }}>
        <div className="relative h-[480px] sm:h-[560px] border-r" style={{ borderColor: "var(--border)" }}>
          {hero && (
            <NewsCard
              article={hero}
              isHero
              index={0}
              priority
              onCategoryClick={onCategoryClick}
              onSourceClick={onSourceClick}
            />
          )}
        </div>

        {/* Right panel: 2 stacked cards that fill their half */}
        <div className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
          {panel1 && (
            <div className="flex-1 flex flex-col" style={{ borderColor: "var(--border)" }}>
              <PanelCard article={panel1} index={1} onCategoryClick={onCategoryClick} onSourceClick={onSourceClick} />
            </div>
          )}
          {panel2 && (
            <div className="flex-1 flex flex-col" style={{ borderTopColor: "var(--border)" }}>
              <PanelCard article={panel2} index={2} onCategoryClick={onCategoryClick} onSourceClick={onSourceClick} />
            </div>
          )}
        </div>
      </div>

      {/* ── Feed grid ─────────────────── */}
      {feedRest.length > 0 && (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          {feedRest.map((article, idx) => (
            <div
              key={article.id}
              className="border-r last:border-r-0 min-h-[260px]"
              style={{ borderColor: "var(--border)" }}
            >
              {isValidImageUrl(article.image_url) ? (
                <div className="h-full min-h-[260px] relative">
                  <NewsCard
                    article={article}
                    index={idx + 3}
                    onCategoryClick={onCategoryClick}
                    onSourceClick={onSourceClick}
                  />
                </div>
              ) : (
                <NewsCard
                  article={article}
                  index={idx + 3}
                  onCategoryClick={onCategoryClick}
                  onSourceClick={onSourceClick}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────── */
export default function NewsGrid({ articles, onCategoryClick, onSourceClick }: NewsGridProps) {
  if (articles.length === 0) return null;

  const hasAnyImage = articles.slice(0, 5).some((a) => isValidImageUrl(a.image_url));

  if (!hasAnyImage) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-10">
        <div className="flex items-center gap-5 mb-10">
          <div className="flex-1 h-px" style={{ background: "var(--border-hover)" }} />
          <span
            className="text-[9px] font-semibold tracking-[0.25em] uppercase"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
          >
            Latest
          </span>
          <div className="flex-1 h-px" style={{ background: "var(--border-hover)" }} />
        </div>
        <div className="sm:columns-2 gap-10">
          {articles.map((a, idx) => (
            <BroadsheetRow
              key={a.id}
              article={a}
              index={idx}
              onCategoryClick={onCategoryClick}
              onSourceClick={onSourceClick}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <EditorialLayout
      articles={articles}
      onCategoryClick={onCategoryClick}
      onSourceClick={onSourceClick}
    />
  );
}
