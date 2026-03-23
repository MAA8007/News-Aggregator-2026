"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { Article, Sections } from "@/app/types";
import NewsCard from "./NewsCard";
import BookmarkButton from "@/app/components/BookmarkButton";

interface FilterCallbacks {
  onCategoryClick: (cat: string) => void;
  onSourceClick: (src: string) => void;
}

interface HomeGridProps extends FilterCallbacks {
  articles: Article[];
  sections: Sections;
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

/* ── Hero right-panel article (NYT right-column style) ────────────── */
function HeroPanelRow({
  article,
  onCategoryClick,
  onSourceClick,
}: { article: Article } & FilterCallbacks) {
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col flex-1 px-6 py-5 border-b last:border-b-0 hover:bg-white/[0.025] transition-colors duration-150"
      style={{ borderColor: "var(--border)" }}
    >
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

      <h3
        className="font-bold italic leading-snug text-xl sm:text-2xl group-hover:opacity-65 transition-opacity duration-200 line-clamp-3"
        style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}
      >
        {article.title}
      </h3>

      {article.snippet && (
        <p className="mt-1.5 text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>
          {article.snippet}
        </p>
      )}

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

/* ── Secondary strip card (NYT's 4-article row) ───────────────────── */
function StripCard({
  article,
  index,
  onCategoryClick,
  onSourceClick,
}: { article: Article; index: number } & FilterCallbacks) {
  const hasImg = isValidImageUrl(article.image_url);
  return (
    <motion.a
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col border-r last:border-r-0 hover:bg-white/[0.02] transition-colors duration-150"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Image */}
      {hasImg && (
        <div className="relative h-[150px] shrink-0 overflow-hidden">
          <Image
            src={article.image_url as string}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            sizes="25vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col flex-1 p-4">
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
        </div>

        <h3
          className="font-bold italic leading-snug text-base sm:text-lg line-clamp-3 group-hover:opacity-65 transition-opacity duration-200"
          style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}
        >
          {article.title}
        </h3>

        <div className="mt-auto pt-3 flex items-center justify-between">
          <button
            onClick={(e) => { e.preventDefault(); onSourceClick(article.source); }}
            className="text-[9px] font-semibold tracking-widest uppercase hover:opacity-70 transition-opacity"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
          >
            {article.source}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[9px]" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
              {article.read_minutes} min
            </span>
            <BookmarkButton article={article} />
          </div>
        </div>
      </div>
    </motion.a>
  );
}

/* ── Section list item (right side of Economist section block) ────── */
function SectionListItem({
  article,
  onCategoryClick: _onCategoryClick,
  onSourceClick,
}: { article: Article } & FilterCallbacks) {
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-4 px-6 py-4 border-b last:border-b-0 hover:bg-white/[0.02] transition-colors duration-150"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {article.pub_date && (
            <>
              <time className="text-[9px]" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
                {relativeTime(article.pub_date)}
              </time>
              <span style={{ color: "var(--text-faint)", fontSize: "8px" }}>·</span>
            </>
          )}
          <span className="text-[9px]" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
            {article.read_minutes} min
          </span>
        </div>

        <h3
          className="font-bold italic leading-snug text-lg sm:text-xl group-hover:opacity-65 transition-opacity duration-200 line-clamp-2"
          style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}
        >
          {article.title}
        </h3>

        {article.snippet && (
          <p className="mt-1 text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>
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

      <div className="shrink-0 flex items-center gap-2 mt-1">
        <BookmarkButton article={article} />
        <span className="text-sm group-hover:translate-x-1 transition-transform duration-200" style={{ color: "var(--text-faint)" }}>→</span>
      </div>
    </a>
  );
}

/* ── Economist-style section block ────────────────────────────────── */
function SectionBlock({
  category,
  articles,
  onCategoryClick,
  onSourceClick,
}: { category: string; articles: Article[] } & FilterCallbacks) {
  if (articles.length === 0) return null;

  // Lead = first article with a valid image; no fallback — if none, text-only layout
  const leadIdx  = articles.findIndex((a) => isValidImageUrl(a.image_url));
  const hasImage = leadIdx >= 0;
  const lead     = hasImage ? articles[leadIdx] : null;
  const textList = hasImage
    ? articles.filter((a) => a.id !== lead!.id).slice(0, 3)
    : articles.slice(0, 4);

  return (
    <div className="border-b" style={{ borderColor: "var(--border)" }}>
      {/* Section header */}
      <div
        className="flex items-center gap-4 px-8 py-3 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          onClick={() => onCategoryClick(category)}
          className="text-[9px] font-semibold tracking-[0.28em] uppercase hover:opacity-70 transition-opacity"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
        >
          {category}
        </button>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        <button
          onClick={() => onCategoryClick(category)}
          className="text-[9px] font-semibold tracking-[0.18em] uppercase hover:opacity-70 transition-opacity"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--accent)" }}
        >
          See all →
        </button>
      </div>

      {hasImage && lead ? (
        /* Image lead + text list side-by-side */
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr]">
          <div className="relative border-r" style={{ borderColor: "var(--border)" }}>
            <NewsCard
              article={lead}
              index={0}
              onCategoryClick={onCategoryClick}
              onSourceClick={onSourceClick}
            />
          </div>
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
            {textList.map((article) => (
              <SectionListItem
                key={article.id}
                article={article}
                onCategoryClick={onCategoryClick}
                onSourceClick={onSourceClick}
              />
            ))}
          </div>
        </div>
      ) : (
        /* No image — full-width text list */
        <div className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
          {textList.map((article) => (
            <SectionListItem
              key={article.id}
              article={article}
              onCategoryClick={onCategoryClick}
              onSourceClick={onSourceClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Latest feed row ──────────────────────────────────────────────── */
function LatestRow({
  article,
  index,
  onCategoryClick,
  onSourceClick,
}: { article: Article; index: number } & FilterCallbacks) {
  return (
    <motion.a
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.4) }}
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-5 py-5 pr-4 border-b hover:bg-white/[0.02] transition-colors duration-150"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="shrink-0 w-14 pt-0.5 text-right">
        {article.pub_date && (
          <time className="text-[9px]" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
            {new Date(article.pub_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </time>
        )}
      </div>
      <div className="shrink-0 w-px self-stretch" style={{ background: "var(--border)" }} />
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
      <div className="shrink-0 flex items-center gap-2 mt-1">
        <BookmarkButton article={article} />
        <span className="text-sm group-hover:translate-x-1 transition-transform duration-200" style={{ color: "var(--text-faint)" }}>→</span>
      </div>
    </motion.a>
  );
}

/* ── Main export ─────────────────────────────────────────────────── */
export default function HomeGrid({
  articles,
  sections,
  onCategoryClick,
  onSourceClick,
}: HomeGridProps) {
  // ── Build a category-diverse pool from sections ───────────────────
  // sections is keyed by category; values are already sorted by recency.
  // Flattening gives [cat1_1, cat1_2, …, cat2_1, cat2_2, …] — naturally
  // diverse because categories with fewer articles exhaust early.
  const pool: Article[] = Object.values(sections).flat();

  // If sections haven't loaded yet, fall back to raw articles
  const source = pool.length > 0 ? pool : articles.slice(0, 20);

  if (source.length === 0) return null;

  // Hero: first article in pool that has a valid image
  const heroPoolIdx = source.findIndex((a) => isValidImageUrl(a.image_url));
  const hero        = source[heroPoolIdx >= 0 ? heroPoolIdx : 0];

  // Panel: 3 articles each from a category not yet represented
  const usedIds  = new Set<number>([hero.id]);
  const usedCats = new Set<string>([hero.category]);
  const panel: Article[] = [];
  for (const a of source) {
    if (panel.length >= 3) break;
    if (usedIds.has(a.id) || usedCats.has(a.category)) continue;
    panel.push(a);
    usedIds.add(a.id);
    usedCats.add(a.category);
  }

  // Strip: 4 image articles, prefer unseen categories, fall back to any unused image article
  const strip: Article[] = [];
  const stripCats = new Set<string>();
  for (const a of source) {
    if (strip.length >= 4) break;
    if (usedIds.has(a.id) || stripCats.has(a.category) || !isValidImageUrl(a.image_url)) continue;
    strip.push(a);
    usedIds.add(a.id);
    stripCats.add(a.category);
  }
  for (const a of source) {
    if (strip.length >= 4) break;
    if (!usedIds.has(a.id) && isValidImageUrl(a.image_url)) { strip.push(a); usedIds.add(a.id); }
  }

  // ── Latest: the global paginated feed (all articles, chronological) ─
  const latest = articles;

  // ── Section blocks ────────────────────────────────────────────────
  const sectionEntries = Object.entries(sections);

  return (
    <div>
      {/* ── Zone 1: Hero + right panel (NYT front-page band) ─────── */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[1fr_380px] border-b"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Hero */}
        <div
          className="relative h-[500px] sm:h-[580px] border-r"
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

        {/* Right panel: 3 stacked articles */}
        <div className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
          {panel.map((article) => (
            <HeroPanelRow
              key={article.id}
              article={article}
              onCategoryClick={onCategoryClick}
              onSourceClick={onSourceClick}
            />
          ))}
        </div>
      </div>

      {/* ── Zone 2: Secondary strip (4 compact cards) ────────────── */}
      {strip.length > 0 && (
        <div
          className={`grid border-b ${
            strip.length === 1 ? "grid-cols-1" :
            strip.length === 2 ? "grid-cols-1 sm:grid-cols-2" :
            strip.length === 3 ? "grid-cols-2 sm:grid-cols-3" :
            "grid-cols-2 sm:grid-cols-4"
          }`}
          style={{ borderColor: "var(--border)" }}
        >
          {strip.map((article, idx) => (
            <StripCard
              key={article.id}
              article={article}
              index={idx}
              onCategoryClick={onCategoryClick}
              onSourceClick={onSourceClick}
            />
          ))}
        </div>
      )}

      {/* ── Zone 3: Economist-style category sections ─────────────── */}
      {sectionEntries.map(([cat, catArticles]) => (
        <SectionBlock
          key={cat}
          category={cat}
          articles={catArticles}
          onCategoryClick={onCategoryClick}
          onSourceClick={onSourceClick}
        />
      ))}

      {/* ── Zone 4: Latest chronological feed ────────────────────── */}
      {latest.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-8 pb-2">
          <div className="flex items-center gap-5 mb-2">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span
              className="text-[9px] font-semibold tracking-[0.28em] uppercase"
              style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
            >
              Latest
            </span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>
          {latest.map((article, idx) => (
            <LatestRow
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
