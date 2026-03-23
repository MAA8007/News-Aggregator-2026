"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { Article } from "@/app/types";
import BookmarkButton from "@/app/components/BookmarkButton";

interface NewsCardProps {
  article: Article;
  isHero?: boolean;
  index?: number;
  priority?: boolean;
  onCategoryClick?: (cat: string) => void;
  onSourceClick?: (src: string) => void;
}

const motionBase = (index: number) => ({
  initial:    { opacity: 0, y: 14 },
  whileInView:{ opacity: 1, y: 0  },
  transition: { duration: 0.5, delay: index * 0.05, ease: "easeOut" },
  viewport:   { once: true, margin: "-60px" },
});

const NON_IMAGE_EXTS = /\.(mp4|mp3|webm|ogg|wav|mov|avi|mkv|flac|m4a|m4v|gif)(\?.*)?$/i;

function isValidImageUrl(url: string | null): url is string {
  if (!url) return false;
  if (!url.startsWith("https://")) return false;   // http:// not allowed by next/image config
  if (NON_IMAGE_EXTS.test(url)) return false;       // video/audio/gif files
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

export default function NewsCard({
  article,
  isHero   = false,
  index    = 0,
  priority = false,
  onCategoryClick,
  onSourceClick,
}: NewsCardProps) {
  if (isValidImageUrl(article.image_url)) {
    return (
      <motion.a
        {...motionBase(index)}
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        className="editorial-img-card group h-full"
      >
        <Image
          src={article.image_url}
          alt={article.title}
          fill
          className="object-cover"
          sizes={isHero ? "50vw" : "25vw"}
          priority={priority}
        />

        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent pointer-events-none" />

        {/* Bookmark — top right */}
        <div className="absolute top-4 right-4 z-10">
          <BookmarkButton article={article} dark />
        </div>

        {/* Category badge */}
        {article.category && (
          <div className="absolute top-4 left-4 z-10">
            <button
              onClick={(e) => { e.preventDefault(); onCategoryClick?.(article.category); }}
              className="text-[9px] font-semibold tracking-[0.2em] uppercase px-2.5 py-1 border transition-colors duration-150 hover:border-white/50 hover:text-white"
              style={{
                fontFamily: "Syne, sans-serif",
                color: "var(--text-muted)",
                borderColor: "rgba(255,255,255,0.18)",
                background: "rgba(0,0,0,0.55)",
              }}
            >
              {article.category}
            </button>
          </div>
        )}

        {/* Bottom overlay */}
        <div className="absolute inset-x-0 bottom-0 z-10 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-2.5" style={{ fontFamily: "Syne, sans-serif" }}>
            <button
              onClick={(e) => { e.preventDefault(); onSourceClick?.(article.source); }}
              className="text-[10px] font-semibold tracking-wider uppercase transition-opacity duration-150 hover:opacity-70"
              style={{ color: "var(--accent)" }}
            >
              {article.source}
            </button>
            {article.pub_date && (
              <>
                <span style={{ color: "rgba(255,255,255,0.18)" }}>·</span>
                <time className="text-[10px] tracking-wide" style={{ color: "var(--text-muted)" }}>
                  {relativeTime(article.pub_date)}
                </time>
              </>
            )}
            <span style={{ color: "rgba(255,255,255,0.18)" }}>·</span>
            <span className="text-[10px] tracking-wide" style={{ color: "var(--text-muted)" }}>
              {article.read_minutes} min
            </span>
          </div>

          <h2
            className={`font-bold italic leading-tight text-white ${
              isHero ? "text-3xl sm:text-[2.6rem] line-clamp-3" : "text-lg sm:text-xl line-clamp-3"
            }`}
            style={{ fontFamily: "Cormorant, Georgia, serif" }}
          >
            {article.title}
          </h2>

          {isHero && (
            <div className="mt-5">
              <span
                className="inline-block text-[10px] font-semibold tracking-[0.2em] uppercase
                           px-5 py-2.5 border border-white/30 text-white/65
                           hover:border-white/70 hover:text-white transition-all duration-200"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                Read Article →
              </span>
            </div>
          )}
        </div>
      </motion.a>
    );
  }

  /* ── Text-only card ─────────────────────────────────────────────── */
  return (
    <motion.a
      {...motionBase(index)}
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className={`editorial-text-card group h-full${isHero ? " border-b-0" : ""}`}
    >
      <div className="h-full flex flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          {article.category ? (
            <button
              onClick={(e) => { e.preventDefault(); onCategoryClick?.(article.category); }}
              className="text-[9px] font-semibold tracking-[0.2em] uppercase transition-opacity duration-150 hover:opacity-70"
              style={{ fontFamily: "Syne, sans-serif", color: "var(--accent)" }}
            >
              {article.category}
            </button>
          ) : (
            <span />
          )}
          {article.pub_date && (
            <time className="text-[9px] tracking-wide" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
              {relativeTime(article.pub_date)}
            </time>
          )}
        </div>

        <h2
          className={`font-bold italic leading-snug line-clamp-4
                      group-hover:opacity-65 transition-opacity duration-200 ${
            isHero ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"
          }`}
          style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}
        >
          {article.title}
        </h2>

        {article.snippet && (
          <p className="mt-3 text-sm leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>
            {article.snippet}
          </p>
        )}

        <div className="mt-auto pt-4 flex items-center justify-between">
          <button
            onClick={(e) => { e.preventDefault(); onSourceClick?.(article.source); }}
            className="text-[9px] font-semibold tracking-widest uppercase transition-opacity duration-150 hover:opacity-70"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
          >
            {article.source}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[9px]" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
              {article.read_minutes} min
            </span>
            <BookmarkButton article={article} />
            <span className="text-xs group-hover:translate-x-1 transition-transform duration-200" style={{ color: "var(--text-faint)" }}>
              →
            </span>
          </div>
        </div>
      </div>
    </motion.a>
  );
}
