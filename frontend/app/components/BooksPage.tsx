"use client";

import { useEffect, useMemo, useState } from "react";
import { BOOKS, type Book } from "@/app/data/books";
import { getStates, toggleBookField, type BookState } from "@/app/lib/books";
import { getCustomBooks, type CustomBook } from "@/app/lib/customBooks";
import AddBookModal from "@/app/components/AddBookModal";

// ── helpers ────────────────────────────────────────────────────────────────

type Filter = "all" | "readlist" | "read" | "bookmarked";
type Sort   = "rank" | "year-new" | "year-old";
type Era    = "all" | "ancient" | "pre1800" | "1800s" | "1900to1960" | "1960to2000" | "2000s";
type Length = "all" | "quick" | "short" | "medium" | "long" | "epic";

function bookEra(year: number): Era {
  if (year <= 0)    return "ancient";
  if (year < 1800)  return "pre1800";
  if (year < 1900)  return "1800s";
  if (year < 1960)  return "1900to1960";
  if (year < 2000)  return "1960to2000";
  return "2000s";
}

function parseReadTimeMinutes(readTime: string): number {
  let total = 0;
  const days = readTime.match(/(\d+)\s+day/);
  const hours = readTime.match(/(\d+)\s+hour/);
  const mins = readTime.match(/(\d+)\s+minute/);
  if (days)  total += parseInt(days[1])  * 24 * 60;
  if (hours) total += parseInt(hours[1]) * 60;
  if (mins)  total += parseInt(mins[1]);
  return total || 1;
}

function bookLength(readTime: string): Length {
  const m = parseReadTimeMinutes(readTime);
  if (m < 120)  return "quick";
  if (m < 300)  return "short";
  if (m < 600)  return "medium";
  if (m < 1200) return "long";
  return "epic";
}

function emptyState(): BookState {
  return { read: false, inList: false, bookmarked: false };
}

// ── row component ──────────────────────────────────────────────────────────

function BookRow({
  book,
  state,
  query,
  onToggle,
}: {
  book: Book;
  state: BookState;
  query: string;
  onToggle: (field: keyof BookState, e: React.MouseEvent) => void;
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
      style={{ borderColor: "var(--border)", opacity: state.read ? 0.6 : 1 }}
    >
      {/* Main row */}
      <div className="flex items-center gap-4 pt-3.5 pb-1">
        {/* Rank */}
        <span
          className="w-9 shrink-0 text-right text-[10px] tabular-nums"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
        >
          {book.ranking}
        </span>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p
            className="font-bold italic leading-snug text-lg sm:text-xl truncate"
            style={{
              fontFamily: "Cormorant, Georgia, serif",
              color: state.read ? "var(--text-muted)" : "var(--text-primary)",
              textDecoration: state.read ? "line-through" : "none",
            }}
          >
            {highlight(book.title)}
          </p>
          <p
            className="text-[9px] tracking-[0.14em] uppercase mt-0.5 truncate"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
          >
            {highlight(book.author)}&ensp;·&ensp;{book.yearDisplay}
            {book.readTime && book.readTime !== "N/A" && <>&ensp;·&ensp;{book.readTime}</>}
          </p>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-0.5">
          <button
            onClick={(e) => onToggle("inList", e)}
            title={state.inList ? "Remove from reading list" : "Add to reading list"}
            className="w-7 h-7 flex items-center justify-center rounded-sm transition-all duration-150"
            style={{
              color: state.inList ? "var(--accent)" : "var(--text-faint)",
              background: state.inList ? "var(--accent-dim)" : "transparent",
            }}
          >
            <span className="text-[11px]">{state.inList ? "◈" : "◇"}</span>
          </button>

          <button
            onClick={(e) => onToggle("read", e)}
            title={state.read ? "Mark unread" : "Mark as read"}
            className="w-7 h-7 flex items-center justify-center rounded-sm transition-all duration-150"
            style={{
              color: state.read ? "#4ade80" : "var(--text-faint)",
              background: state.read ? "rgba(74,222,128,0.08)" : "transparent",
            }}
          >
            <span className="text-[11px]">{state.read ? "✓" : "○"}</span>
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
      {book.description && book.description !== "N/A" && (
        <p
          className="pb-3.5 pl-[52px] pr-4 sm:pr-[100px] text-[12px] leading-relaxed"
          style={{
            fontFamily: "Cormorant, Georgia, serif",
            color: "var(--text-muted)",
            fontStyle: "italic",
          }}
        >
          {book.description}
        </p>
      )}
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────

export default function BooksPage() {
  const [filter,       setFilter]       = useState<Filter>("all");
  const [sort,         setSort]         = useState<Sort>("rank");
  const [era,          setEra]          = useState<Era>("all");
  const [length,       setLength]       = useState<Length>("all");
  const [query,        setQuery]        = useState("");
  const [states,       setStates]       = useState<Record<number, BookState>>({});
  const [customBooks,  setCustomBooks]  = useState<CustomBook[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Sync states from localStorage and listen for changes
  useEffect(() => {
    setStates(getStates());
    const handler = () => setStates(getStates());
    window.addEventListener("book-states-changed", handler);
    return () => window.removeEventListener("book-states-changed", handler);
  }, []);

  // Sync custom books
  useEffect(() => {
    setCustomBooks(getCustomBooks());
    const handler = () => setCustomBooks(getCustomBooks());
    window.addEventListener("custom-books-changed", handler);
    return () => window.removeEventListener("custom-books-changed", handler);
  }, []);

  const allBooks = useMemo<Book[]>(
    () => [...BOOKS, ...customBooks],
    [customBooks],
  );

  function handleToggle(ranking: number, field: keyof BookState, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggleBookField(ranking, field);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = allBooks.filter((b) => {
      if (q && !b.title.toLowerCase().includes(q) && !b.author.toLowerCase().includes(q)) return false;
      if (era    !== "all" && bookEra(b.year)        !== era)    return false;
      if (length !== "all" && bookLength(b.readTime) !== length) return false;
      const s = states[b.ranking];
      if (filter === "readlist")   return !!s?.inList;
      if (filter === "read")       return !!s?.read;
      if (filter === "bookmarked") return !!s?.bookmarked;
      return true;
    });
    if (sort === "year-new") list = [...list].sort((a, b) => b.year - a.year);
    if (sort === "year-old") list = [...list].sort((a, b) => a.year - b.year);
    return list;
  }, [filter, sort, era, length, query, states, allBooks]);

  // Counts
  const readlistCount   = Object.values(states).filter((s) => s.inList).length;
  const readCount       = Object.values(states).filter((s) => s.read).length;
  const bookmarkedCount = Object.values(states).filter((s) => s.bookmarked).length;

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all",        label: "All",          count: allBooks.length },
    { key: "readlist",   label: "Reading List", count: readlistCount },
    { key: "read",       label: "Read",         count: readCount },
    { key: "bookmarked", label: "Saved",        count: bookmarkedCount },
  ];

  const sorts: { key: Sort; label: string }[] = [
    { key: "rank",     label: "By Rank" },
    { key: "year-new", label: "Newest" },
    { key: "year-old", label: "Oldest" },
  ];

  const eras: { key: Era; label: string }[] = [
    { key: "all",        label: "All Eras" },
    { key: "ancient",    label: "Ancient BC" },
    { key: "pre1800",    label: "Pre-1800" },
    { key: "1800s",      label: "1800s" },
    { key: "1900to1960", label: "1900–1960" },
    { key: "1960to2000", label: "1960–2000" },
    { key: "2000s",      label: "2000s+" },
  ];

  const lengths: { key: Length; label: string }[] = [
    { key: "all",    label: "Any Length" },
    { key: "quick",  label: "Quick  < 2h" },
    { key: "short",  label: "Short  2–5h" },
    { key: "medium", label: "Medium 5–10h" },
    { key: "long",   label: "Long  10–20h" },
    { key: "epic",   label: "Epic   20h+" },
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
            Books
          </h1>
          <p
            className="text-[9px] tracking-[0.25em] uppercase"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
          >
            {allBooks.length} books · ranked by critical consensus
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
          Add Book
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
          placeholder="Search title or author…"
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

      {/* ── Era filter ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        <span
          className="text-[8px] font-semibold tracking-[0.2em] uppercase mr-1.5 shrink-0"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
        >
          Era
        </span>
        {eras.map((e) => (
          <button
            key={e.key}
            onClick={() => setEra(e.key)}
            className="px-2.5 py-1 text-[8px] font-semibold tracking-[0.14em] uppercase border transition-all duration-150"
            style={{
              fontFamily: "Syne, sans-serif",
              borderColor: era === e.key ? "var(--accent-border)" : "var(--border)",
              color: era === e.key ? "var(--accent)" : "var(--text-faint)",
              background: era === e.key ? "var(--accent-dim)" : "transparent",
            }}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* ── Length filter ───────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-6 flex-wrap">
        <span
          className="text-[8px] font-semibold tracking-[0.2em] uppercase mr-1.5 shrink-0"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
        >
          Length
        </span>
        {lengths.map((l) => (
          <button
            key={l.key}
            onClick={() => setLength(l.key)}
            className="px-2.5 py-1 text-[8px] font-semibold tracking-[0.14em] uppercase border transition-all duration-150"
            style={{
              fontFamily: "Syne, sans-serif",
              borderColor: length === l.key ? "var(--accent-border)" : "var(--border)",
              color: length === l.key ? "var(--accent)" : "var(--text-faint)",
              background: length === l.key ? "var(--accent-dim)" : "transparent",
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* ── Column headers ─────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 pb-2 mb-1 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="w-9 shrink-0 text-right text-[8px] tracking-[0.2em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>#</span>
        <span className="flex-1 text-[8px] tracking-[0.2em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>Title · Author · Read Time</span>
        <span className="shrink-0 w-[88px] text-center text-[8px] tracking-[0.2em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>List · Read · Save</span>
      </div>

      {/* ── Book list ──────────────────────────────────────────── */}
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
          {filtered.map((book) => (
            <BookRow
              key={book.ranking}
              book={book}
              state={states[book.ranking] ?? emptyState()}
              query={query.trim()}
              onToggle={(field, e) => handleToggle(book.ranking, field, e)}
            />
          ))}
          <p
            className="py-8 text-center text-[8px] tracking-[0.2em] uppercase"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
          >
            {filtered.length} book{filtered.length !== 1 ? "s" : ""}
          </p>
        </>
      )}
    </div>

    {addModalOpen && <AddBookModal onClose={() => setAddModalOpen(false)} />}
    </>
  );
}
