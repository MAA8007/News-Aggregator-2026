"use client";

import { useEffect, useRef, useState } from "react";
import { addCustomBook, getCustomBooks, removeCustomBook, type CustomBook } from "@/app/lib/customBooks";

interface AddBookModalProps {
  onClose: () => void;
}

export default function AddBookModal({ onClose }: AddBookModalProps) {
  const [title,       setTitle]       = useState("");
  const [author,      setAuthor]      = useState("");
  const [year,        setYear]        = useState("");
  const [readTime,    setReadTime]    = useState("");
  const [description, setDescription] = useState("");
  const [message,     setMessage]     = useState("");
  const [books,    setBooks]    = useState<CustomBook[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBooks(getCustomBooks());
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = () => setBooks(getCustomBooks());
    window.addEventListener("custom-books-changed", handler);
    return () => window.removeEventListener("custom-books-changed", handler);
  }, []);

  function handleAdd() {
    const t = title.trim();
    const a = author.trim();
    const y = parseInt(year.trim(), 10);
    const r = readTime.trim();
    if (!t) { setMessage("Title is required."); return; }
    const parsedYear = isNaN(y) ? new Date().getFullYear() : y;

    addCustomBook({ title: t, author: a, year: parsedYear, readTime: r, description: description.trim() });
    setBooks(getCustomBooks());
    setMessage(`"${t}" added.`);
    setTitle("");
    setAuthor("");
    setYear("");
    setReadTime("");
    setDescription("");
  }

  function handleRemove(ranking: number) {
    removeCustomBook(ranking);
    setBooks(getCustomBooks());
    setMessage("");
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>
      {/* ── Header ───────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-8 border-b"
        style={{ borderColor: "var(--border)", height: "57px" }}
      >
        <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>◈</span>
        <span
          className="flex-1 text-[10px] font-semibold tracking-[0.22em] uppercase"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-muted)" }}
        >
          Add to Books
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
              Add a book
            </p>

            <div className="flex flex-col gap-3">
              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] tracking-[0.15em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
                  Title
                </label>
                <input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setMessage(""); }}
                  placeholder="The Master and Margarita"
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

              {/* Author + Year in a row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] tracking-[0.15em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
                    Author
                  </label>
                  <input
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Mikhail Bulgakov"
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
                    Year
                  </label>
                  <input
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="1967"
                    className="w-full px-4 py-2.5 border bg-transparent outline-none text-sm"
                    style={{
                      borderColor: "var(--border-hover)",
                      color: "var(--text-primary)",
                      fontFamily: "Syne, sans-serif",
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                  />
                </div>
              </div>

              {/* Read time */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] tracking-[0.15em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
                  Est. Read Time (optional)
                </label>
                <input
                  value={readTime}
                  onChange={(e) => setReadTime(e.target.value)}
                  placeholder="8 hours and 16 minutes"
                  className="w-full px-4 py-2.5 border bg-transparent outline-none text-sm"
                  style={{
                    borderColor: "var(--border-hover)",
                    color: "var(--text-primary)",
                    fontFamily: "Syne, sans-serif",
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] tracking-[0.15em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A brief synopsis or note about this book…"
                  rows={3}
                  className="w-full px-4 py-2.5 border bg-transparent outline-none text-sm resize-none"
                  style={{
                    borderColor: "var(--border-hover)",
                    color: "var(--text-primary)",
                    fontFamily: "Syne, sans-serif",
                  }}
                />
              </div>

              {/* Submit */}
              <div className="flex items-center gap-4 mt-1">
                <button
                  onClick={handleAdd}
                  disabled={!title.trim()}
                  className="px-6 py-2.5 border text-[9px] font-semibold tracking-[0.18em] uppercase transition-all duration-200 disabled:opacity-40"
                  style={{
                    fontFamily: "Syne, sans-serif",
                    borderColor: "var(--accent-border)",
                    color: "var(--accent)",
                    background: "var(--accent-dim)",
                  }}
                >
                  Add Book
                </button>

                {message && (
                  <p
                    className="text-[9px] tracking-wide"
                    style={{ fontFamily: "Syne, sans-serif", color: "var(--accent)" }}
                  >
                    {message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Added books ──────────────────────────────────────── */}
          {books.length > 0 && (
            <div>
              <p
                className="text-[9px] font-semibold tracking-[0.25em] uppercase mb-4"
                style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
              >
                Your added books
              </p>
              <div className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
                {books.map((b) => (
                  <div key={b.ranking} className="flex items-center gap-4 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-bold italic leading-snug truncate"
                        style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}
                      >
                        {b.title}
                      </p>
                      <p
                        className="text-[9px] tracking-[0.14em] uppercase mt-0.5 truncate"
                        style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
                      >
                        {b.author && <>{b.author}&ensp;·&ensp;</>}{b.yearDisplay}
                        {b.readTime && <>&ensp;·&ensp;{b.readTime}</>}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemove(b.ranking)}
                      className="shrink-0 text-[9px] font-semibold tracking-[0.15em] uppercase hover:opacity-60 transition-opacity"
                      style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {books.length === 0 && (
            <p
              className="text-[9px] tracking-[0.15em] uppercase"
              style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
            >
              No books added yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
