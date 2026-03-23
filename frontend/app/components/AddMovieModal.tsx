"use client";

import { useEffect, useRef, useState } from "react";
import { addCustomMovie, getCustomMovies, removeCustomMovie, type CustomMovie } from "@/app/lib/customMovies";

interface AddMovieModalProps {
  onClose: () => void;
}

export default function AddMovieModal({ onClose }: AddMovieModalProps) {
  const [title,       setTitle]       = useState("");
  const [director,    setDirector]    = useState("");
  const [year,        setYear]        = useState("");
  const [score,       setScore]       = useState("");
  const [genre,       setGenre]       = useState("");
  const [description, setDescription] = useState("");
  const [message,     setMessage]     = useState("");
  const [movies,   setMovies]   = useState<CustomMovie[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMovies(getCustomMovies());
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Sync list when another tab or modal interaction triggers the event
  useEffect(() => {
    const handler = () => setMovies(getCustomMovies());
    window.addEventListener("custom-movies-changed", handler);
    return () => window.removeEventListener("custom-movies-changed", handler);
  }, []);

  function handleAdd() {
    const t = title.trim();
    const d = director.trim();
    const y = parseInt(year.trim(), 10);
    const s = parseFloat(score.trim());
    if (!t) { setMessage("Title is required."); return; }
    const parsedYear = isNaN(y) ? new Date().getFullYear() : y;
    const parsedScore = isNaN(s) ? 0 : Math.min(10, Math.max(0, s)) * 10;

    addCustomMovie({ title: t, director: d, year: parsedYear, overallScore: parsedScore, description: description.trim(), genre: genre.trim() });
    setMovies(getCustomMovies());
    setMessage(`"${t}" added.`);
    setTitle("");
    setDirector("");
    setYear("");
    setScore("");
    setGenre("");
    setDescription("");
  }

  function handleRemove(ranking: number) {
    removeCustomMovie(ranking);
    setMovies(getCustomMovies());
    setMessage("");
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>
      {/* ── Header ───────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-8 border-b"
        style={{ borderColor: "var(--border)", height: "57px" }}
      >
        <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>▷</span>
        <span
          className="flex-1 text-[10px] font-semibold tracking-[0.22em] uppercase"
          style={{ fontFamily: "Syne, sans-serif", color: "var(--text-muted)" }}
        >
          Add to Films
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
              Add a film
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
                  placeholder="Synecdoche, New York"
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

              {/* Director + Year in a row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] tracking-[0.15em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
                    Director
                  </label>
                  <input
                    value={director}
                    onChange={(e) => setDirector(e.target.value)}
                    placeholder="Charlie Kaufman"
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
                    placeholder="2008"
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

              {/* IMDb Score */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] tracking-[0.15em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
                  IMDb Score (1–10, optional)
                </label>
                <input
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="7.5"
                  className="w-full px-4 py-2.5 border bg-transparent outline-none text-sm"
                  style={{
                    borderColor: "var(--border-hover)",
                    color: "var(--text-primary)",
                    fontFamily: "Syne, sans-serif",
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                />
              </div>

              {/* Genre */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] tracking-[0.15em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
                  Genre (optional)
                </label>
                <input
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="Drama, Thriller, Sci-Fi…"
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
                  placeholder="A brief synopsis or note about this film…"
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
                  Add Film
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

          {/* ── Added films ──────────────────────────────────────── */}
          {movies.length > 0 && (
            <div>
              <p
                className="text-[9px] font-semibold tracking-[0.25em] uppercase mb-4"
                style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
              >
                Your added films
              </p>
              <div className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
                {movies.map((m) => (
                  <div key={m.ranking} className="flex items-center gap-4 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-bold italic leading-snug truncate"
                        style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}
                      >
                        {m.title}
                      </p>
                      <p
                        className="text-[9px] tracking-[0.14em] uppercase mt-0.5 truncate"
                        style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
                      >
                        {m.director && <>{m.director}&ensp;·&ensp;</>}{m.year}
                        {m.overallScore > 0 && <>&ensp;·&ensp;{(m.overallScore / 10).toFixed(1)}</>}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemove(m.ranking)}
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

          {movies.length === 0 && (
            <p
              className="text-[9px] tracking-[0.15em] uppercase"
              style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}
            >
              No films added yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
