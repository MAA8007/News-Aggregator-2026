"use client";

import { useEffect, useMemo, useState } from "react";
import { MOVIES, type Movie } from "@/app/data/movies";
import { getStates, toggleMovieField, type MovieState } from "@/app/lib/movies";
import { getCustomMovies, type CustomMovie } from "@/app/lib/customMovies";
import AddMovieModal from "@/app/components/AddMovieModal";

// ── helpers ────────────────────────────────────────────────────────────────

type Filter = "all" | "watchlist" | "watched" | "bookmarked";
type Sort   = "rank" | "year-new" | "year-old";
type Decade = "all" | "pre1950" | "1950s" | "1960s" | "1970s" | "1980s" | "1990s" | "2000s";

function movieDecade(year: number): Decade {
  if (year < 1950) return "pre1950";
  if (year < 1960) return "1950s";
  if (year < 1970) return "1960s";
  if (year < 1980) return "1970s";
  if (year < 1990) return "1980s";
  if (year < 2000) return "1990s";
  return "2000s";
}

function scoreColor(score: number): string {
  if (score >= 88) return "var(--accent)";
  if (score >= 84) return "var(--text-primary)";
  return "var(--text-muted)";
}

function emptyState(): MovieState {
  return { watched: false, inList: false, bookmarked: false };
}

// ── row component ──────────────────────────────────────────────────────────

function MovieRow({
  movie,
  state,
  query,
  onToggle,
}: {
  movie: Movie;
  state: MovieState;
  query: string;
  onToggle: (field: keyof MovieState, e: React.MouseEvent) => void;
}) {
  function highlight(text: string) {
    if (!query) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: "var(--accent-dim)", color: "var(--accent)", borderRadius: "2px", padding: "0 1px" }}>
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  }

  return (
    <div
      className="border-b transition-colors duration-150"
      style={{
        borderColor: "var(--border)",
        opacity: state.watched ? 0.6 : 1,
      }}
    >
      <div className="flex items-center gap-4 pt-3.5 pb-1">
        {/* Rank */}
        <span
          className="w-9 shrink-0 text-right text-[10px] tabular-nums"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
        >
          {movie.ranking}
        </span>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p
            className="font-bold italic leading-snug text-lg sm:text-xl truncate"
            style={{
              fontFamily: "Cormorant, Georgia, serif",
              color: state.watched ? "var(--text-muted)" : "var(--text-primary)",
              textDecoration: state.watched ? "line-through" : "none",
            }}
          >
            {highlight(movie.title)}
          </p>
          <p
            className="text-[9px] tracking-[0.14em] uppercase mt-0.5 truncate"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
          >
            {highlight(movie.director)}&ensp;·&ensp;{movie.year}
            {movie.genre && <>&ensp;·&ensp;{movie.genre}</>}
          </p>
        </div>

        {/* Score */}
        <span
          className="shrink-0 text-[11px] font-semibold tabular-nums"
          style={{ fontFamily: "Syne, sans-serif", color: scoreColor(movie.overallScore) }}
        >
          {movie.overallScore.toFixed(1)}
        </span>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-0.5">
          <button
            onClick={(e) => onToggle("inList", e)}
            title={state.inList ? "Remove from watchlist" : "Add to watchlist"}
            className="w-7 h-7 flex items-center justify-center rounded-sm transition-all duration-150"
            style={{
              color: state.inList ? "var(--accent)" : "var(--text-faint)",
              background: state.inList ? "var(--accent-dim)" : "transparent",
            }}
          >
            <span className="text-[11px]">{state.inList ? "◈" : "◇"}</span>
          </button>

          <button
            onClick={(e) => onToggle("watched", e)}
            title={state.watched ? "Mark unwatched" : "Mark as watched"}
            className="w-7 h-7 flex items-center justify-center rounded-sm transition-all duration-150"
            style={{
              color: state.watched ? "#4ade80" : "var(--text-faint)",
              background: state.watched ? "rgba(74,222,128,0.08)" : "transparent",
            }}
          >
            <span className="text-[11px]">{state.watched ? "✓" : "○"}</span>
          </button>

          <button
            onClick={(e) => onToggle("bookmarked", e)}
            title={state.bookmarked ? "Remove bookmark" : "Bookmark"}
            className="w-7 h-7 flex items-center justify-center rounded-sm transition-all duration-150"
            style={{
              color: state.bookmarked ? "var(--accent)" : "var(--text-faint)",
              background: state.bookmarked ? "var(--accent-dim)" : "transparent",
            }}
          >
            <span className="text-[11px]">{state.bookmarked ? "◼" : "◻"}</span>
          </button>
        </div>
      </div>

      {/* Description — always visible */}
      {movie.description && (
        <p
          className="pb-3.5 pl-[52px] pr-4 sm:pr-[100px] text-[12px] leading-relaxed"
          style={{
            fontFamily: "Cormorant, Georgia, serif",
            color: "var(--text-muted)",
            fontStyle: "italic",
          }}
        >
          {movie.description}
        </p>
      )}
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────

export default function MoviesPage() {
  const [filter,        setFilter]        = useState<Filter>("all");
  const [sort,          setSort]          = useState<Sort>("rank");
  const [decade,        setDecade]        = useState<Decade>("all");
  const [genre,         setGenre]         = useState("");
  const [query,         setQuery]         = useState("");
  const [states,        setStates]        = useState<Record<number, MovieState>>({});
  const [customMovies,  setCustomMovies]  = useState<CustomMovie[]>([]);
  const [addModalOpen,  setAddModalOpen]  = useState(false);

  // Sync states from localStorage and listen for changes
  useEffect(() => {
    setStates(getStates());
    const handler = () => setStates(getStates());
    window.addEventListener("movie-states-changed", handler);
    return () => window.removeEventListener("movie-states-changed", handler);
  }, []);

  // Sync custom movies
  useEffect(() => {
    setCustomMovies(getCustomMovies());
    const handler = () => setCustomMovies(getCustomMovies());
    window.addEventListener("custom-movies-changed", handler);
    return () => window.removeEventListener("custom-movies-changed", handler);
  }, []);

  const allMovies = useMemo<Movie[]>(
    () => [...MOVIES, ...customMovies],
    [customMovies],
  );

  const genres = useMemo(
    () => Array.from(new Set(allMovies.map((m) => m.genre).filter(Boolean))).sort(),
    [allMovies],
  );

  function handleToggle(ranking: number, field: keyof MovieState, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggleMovieField(ranking, field);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = allMovies.filter((m) => {
      if (q && !m.title.toLowerCase().includes(q) && !m.director.toLowerCase().includes(q)) return false;
      if (decade !== "all" && movieDecade(m.year) !== decade) return false;
      if (genre && m.genre !== genre) return false;
      const s = states[m.ranking];
      if (filter === "watchlist")  return !!s?.inList;
      if (filter === "watched")    return !!s?.watched;
      if (filter === "bookmarked") return !!s?.bookmarked;
      return true;
    });
    if (sort === "year-new") list = [...list].sort((a, b) => b.year - a.year);
    if (sort === "year-old") list = [...list].sort((a, b) => a.year - b.year);
    return list;
  }, [filter, sort, decade, genre, query, states, allMovies]);

  // Counts
  const watchlistCount  = Object.values(states).filter((s) => s.inList).length;
  const watchedCount    = Object.values(states).filter((s) => s.watched).length;
  const bookmarkedCount = Object.values(states).filter((s) => s.bookmarked).length;

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all",        label: "All",       count: allMovies.length },
    { key: "watchlist",  label: "Watchlist", count: watchlistCount },
    { key: "watched",    label: "Watched",   count: watchedCount },
    { key: "bookmarked", label: "Saved",     count: bookmarkedCount },
  ];

  const sorts: { key: Sort; label: string }[] = [
    { key: "rank",     label: "By Rank" },
    { key: "year-new", label: "Newest" },
    { key: "year-old", label: "Oldest" },
  ];

  const decades: { key: Decade; label: string }[] = [
    { key: "all",     label: "All Eras" },
    { key: "pre1950", label: "Pre-1950" },
    { key: "1950s",   label: "1950s" },
    { key: "1960s",   label: "1960s" },
    { key: "1970s",   label: "1970s" },
    { key: "1980s",   label: "1980s" },
    { key: "1990s",   label: "1990s" },
    { key: "2000s",   label: "2000s+" },
  ];

  return (
    <>
    <div className="px-4 sm:px-8 py-4 sm:py-8 max-w-4xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-5xl font-bold italic leading-none mb-1"
            style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}
          >
            Films
          </h1>
          <p
            className="text-[9px] tracking-[0.25em] uppercase"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
          >
            {allMovies.length} films · ranked by composite score
          </p>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 border text-[9px] font-semibold tracking-[0.18em] uppercase transition-all duration-200 mb-1"
          style={{
            fontFamily: "Syne, sans-serif",
            borderColor: "var(--border-hover)",
            color: "var(--text-muted)",
          }}
        >
          <span className="text-[11px]">⊕</span>
          Add Film
        </button>
      </div>

      {/* ── Controls ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">

        {/* Filter tabs */}
        <div className="flex items-center gap-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className="px-3 py-1.5 text-[9px] font-semibold tracking-[0.18em] uppercase transition-all duration-150"
              style={{
                fontFamily: "Syne, sans-serif",
                color: filter === t.key ? "var(--accent)" : "var(--text-faint)",
                background: filter === t.key ? "var(--accent-dim)" : "transparent",
                borderRadius: "2px",
              }}
            >
              {t.label}
              {t.count > 0 && (
                <span className="ml-1" style={{ opacity: filter === t.key ? 0.7 : 0.5 }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title or director…"
          className="bg-transparent border-b text-[11px] outline-none pb-0.5 w-44"
          style={{
            fontFamily: "Syne, sans-serif",
            color: "var(--text-primary)",
            borderColor: "var(--border-hover)",
          }}
        />

        {/* Sort */}
        <div className="flex items-center gap-0.5">
          {sorts.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className="px-2.5 py-1.5 text-[8px] font-semibold tracking-[0.16em] uppercase transition-all duration-150"
              style={{
                fontFamily: "Syne, sans-serif",
                color: sort === s.key ? "var(--text-primary)" : "var(--text-faint)",
                borderBottom: sort === s.key ? "1px solid var(--text-primary)" : "1px solid transparent",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Decade filter ──────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-6 flex-wrap">
        <span
          className="text-[8px] font-semibold tracking-[0.2em] uppercase mr-1.5 shrink-0"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
        >
          Era
        </span>
        {decades.map((d) => (
          <button
            key={d.key}
            onClick={() => setDecade(d.key)}
            className="px-2.5 py-1 text-[8px] font-semibold tracking-[0.14em] uppercase border transition-all duration-150"
            style={{
              fontFamily: "Syne, sans-serif",
              borderColor: decade === d.key ? "var(--accent-border)" : "var(--border)",
              color: decade === d.key ? "var(--accent)" : "var(--text-faint)",
              background: decade === d.key ? "var(--accent-dim)" : "transparent",
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* ── Genre filter ───────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-6 flex-wrap">
        <span
          className="text-[8px] font-semibold tracking-[0.2em] uppercase mr-1.5 shrink-0"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
        >
          Genre
        </span>
        <button
          onClick={() => setGenre("")}
          className="px-2.5 py-1 text-[8px] font-semibold tracking-[0.14em] uppercase border transition-all duration-150"
          style={{
            fontFamily: "Syne, sans-serif",
            borderColor: genre === "" ? "var(--accent-border)" : "var(--border)",
            color: genre === "" ? "var(--accent)" : "var(--text-faint)",
            background: genre === "" ? "var(--accent-dim)" : "transparent",
          }}
        >
          All
        </button>
        {genres.map((g) => (
          <button
            key={g}
            onClick={() => setGenre(genre === g ? "" : g)}
            className="px-2.5 py-1 text-[8px] font-semibold tracking-[0.14em] uppercase border transition-all duration-150"
            style={{
              fontFamily: "Syne, sans-serif",
              borderColor: genre === g ? "var(--accent-border)" : "var(--border)",
              color: genre === g ? "var(--accent)" : "var(--text-faint)",
              background: genre === g ? "var(--accent-dim)" : "transparent",
            }}
          >
            {g}
          </button>
        ))}
      </div>

      {/* ── Column headers ─────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 pb-2 mb-1 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="w-9 shrink-0 text-right text-[8px] tracking-[0.2em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>#</span>
        <span className="flex-1 text-[8px] tracking-[0.2em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>Title</span>
        <span className="shrink-0 text-[8px] tracking-[0.2em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>Score</span>
        <span className="shrink-0 w-[88px] text-center text-[8px] tracking-[0.2em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>List · Seen · Save</span>
      </div>

      {/* ── Movie list ─────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <p
            className="text-[10px] tracking-[0.2em] uppercase"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
          >
            {filter !== "all" ? "Nothing here yet" : "No results"}
          </p>
        </div>
      ) : (
        <>
          {filtered.map((movie) => (
            <MovieRow
              key={movie.ranking}
              movie={movie}
              state={states[movie.ranking] ?? emptyState()}
              query={query.trim()}
              onToggle={(field, e) => handleToggle(movie.ranking, field, e)}
            />
          ))}
          <p
            className="py-8 text-center text-[8px] tracking-[0.2em] uppercase"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
          >
            {filtered.length} film{filtered.length !== 1 ? "s" : ""}
          </p>
        </>
      )}
    </div>

    {addModalOpen && <AddMovieModal onClose={() => setAddModalOpen(false)} />}
    </>
  );
}
