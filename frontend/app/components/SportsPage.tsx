"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  fetchF1DriverStandings, fetchF1ConstructorStandings, fetchF1Schedule,
  fetchF1RaceResults, fetchF1QualifyingResults, fetchF1SprintResults,
  fetchF1Chart,
  fetchFootballStandings, fetchFootballScorers, fetchFootballMatches, fetchTeamMatches,
  parseStandings, parseStandingGroups, parseScorers, parseMatches, parseSeasonLabel,
  type F1Driver, type F1Constructor, type F1Race,
  type F1RaceResult, type F1QualifyingResult,
  type FDStandingEntry, type FDStandingGroup, type FDScorer, type FDMatch,
} from "@/app/lib/sportsApi";
import { useRaceState, useMatchState } from "@/app/lib/sportsStates";

// ── Constants ─────────────────────────────────────────────────────────────────

const F1_SEASON    = 2026;
const LIVERPOOL_ID = 64;

type Sport          = "f1" | "football" | "liverpool";
type F1Tab          = "drivers" | "constructors" | "calendar" | "latest" | "analytics";
type RaceDetailTab  = "race" | "qualifying" | "sprint";
type FBTab          = "standings" | "scorers" | "matches";
type LivTab         = "results" | "upcoming" | "history";
type MFilter        = "all" | "results" | "upcoming";

interface Competition { code: string; name: string; group?: string }

const COMPETITIONS: Competition[] = [
  { code: "PL",  name: "Premier League",       group: "England" },
  { code: "ELC", name: "Championship",          group: "England" },
  { code: "CL",  name: "Champions League",      group: "Europe"  },
  { code: "PD",  name: "La Liga",               group: "Europe"  },
  { code: "BL1", name: "Bundesliga",            group: "Europe"  },
  { code: "SA",  name: "Serie A",               group: "Europe"  },
  { code: "FL1", name: "Ligue 1",               group: "Europe"  },
];

// ── Liverpool UCL history ─────────────────────────────────────────────────────

const LIV_FINALS = [
  { year: 2022, opponent: "Real Madrid",               score: "0–1",         venue: "Stade de France, Paris",             result: "runner-up" },
  { year: 2019, opponent: "Tottenham Hotspur",         score: "2–0",         venue: "Wanda Metropolitano, Madrid",        result: "winner"    },
  { year: 2018, opponent: "Real Madrid",               score: "1–3",         venue: "NSC Olimpiyskiy, Kyiv",              result: "runner-up" },
  { year: 2007, opponent: "AC Milan",                  score: "1–2",         venue: "Olympic Stadium, Athens",            result: "runner-up" },
  { year: 2005, opponent: "AC Milan",                  score: "3–3 (3–2 p)", venue: "Atatürk Olympic Stadium, Istanbul", result: "winner"    },
  { year: 1985, opponent: "Juventus",                  score: "0–1",         venue: "Heysel Stadium, Brussels",           result: "runner-up" },
  { year: 1984, opponent: "AS Roma",                   score: "1–1 (4–2 p)", venue: "Stadio Olimpico, Rome",              result: "winner"    },
  { year: 1981, opponent: "Real Madrid",               score: "1–0",         venue: "Parc des Princes, Paris",            result: "winner"    },
  { year: 1978, opponent: "Club Brugge",               score: "1–0",         venue: "Wembley Stadium, London",            result: "winner"    },
  { year: 1977, opponent: "Borussia M'gladbach",       score: "3–1",         venue: "Stadio Olimpico, Rome",              result: "winner"    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLiv(name: string) { return name?.toLowerCase().includes("liverpool"); }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function statusColor(s: string) {
  if (["FINISHED", "AWARDED"].includes(s)) return "#4caf50";
  if (["IN_PLAY", "PAUSED", "LIVE"].includes(s)) return "#ff9800";
  if (["POSTPONED", "SUSPENDED", "CANCELLED"].includes(s)) return "#e05";
  return "var(--text-faint)";
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    SCHEDULED: "NS", FINISHED: "FT", IN_PLAY: "LIVE",
    PAUSED: "HT", POSTPONED: "PPD", SUSPENDED: "SUSP",
    CANCELLED: "CANC", AWARDED: "AWD",
  };
  return map[s] ?? s;
}

function FormChar({ ch }: { ch: string }) {
  const color = ch === "W" ? "#4caf50" : ch === "L" ? "#e05" : "var(--text-muted)";
  return <span style={{ color, fontWeight: 600 }}>{ch}</span>;
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function TabBar<T extends string>({
  tabs, active, onChange,
}: { tabs: { key: T; label: string }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="flex gap-1 mb-5 flex-wrap">
      {tabs.map(({ key, label }) => (
        <button key={key} onClick={() => onChange(key)}
          className="px-4 py-1.5 text-[11px] font-semibold tracking-[0.15em] uppercase transition-colors"
          style={{
            fontFamily: "Syne, sans-serif",
            borderBottom: active === key ? "2px solid var(--accent)" : "2px solid transparent",
            color: active === key ? "var(--accent)" : "var(--text-muted)",
          }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center py-16">
      <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "var(--text-faint)", borderTopColor: "transparent" }} />
    </div>
  );
}

function ErrorRow({ msg }: { msg: string }) {
  return (
    <div className="py-10 text-center text-sm"
      style={{ color: "#ff6b6b", fontFamily: "Syne, sans-serif" }}>
      {msg}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-semibold tracking-[0.25em] uppercase mt-1 mb-2"
      style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
      {children}
    </p>
  );
}

function Pill({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase rounded-sm transition-all"
      style={{
        fontFamily: "Syne, sans-serif",
        background: active ? "var(--accent-dim)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-muted)",
        border: "1px solid",
        borderColor: active ? "var(--accent-border)" : "var(--border)",
      }}>
      {label}
    </button>
  );
}

// ── Race tracking buttons ─────────────────────────────────────────────────────

function RaceBtns({ raceKey }: { raceKey: string }) {
  const { state, toggle } = useRaceState(raceKey);
  return (
    <div className="flex gap-2 shrink-0">
      <button onClick={(e) => toggle("watched", e)} title="Watched"
        className="text-[13px] transition-opacity hover:opacity-60"
        style={{ color: state.watched ? "var(--accent)" : "var(--text-faint)" }}>
        {state.watched ? "●" : "○"}
      </button>
      <button onClick={(e) => toggle("bookmarked", e)} title="Bookmark"
        className="text-[13px] transition-opacity hover:opacity-60"
        style={{ color: state.bookmarked ? "var(--accent)" : "var(--text-faint)" }}>
        {state.bookmarked ? "◼" : "◻"}
      </button>
    </div>
  );
}

function MatchBtns({ matchId }: { matchId: string }) {
  const { state, toggle } = useMatchState(matchId);
  return (
    <div className="flex gap-2 shrink-0">
      <button onClick={(e) => toggle("watched", e)} title="Watched"
        className="text-[13px] transition-opacity hover:opacity-60"
        style={{ color: state.watched ? "var(--accent)" : "var(--text-faint)" }}>
        {state.watched ? "●" : "○"}
      </button>
      <button onClick={(e) => toggle("bookmarked", e)} title="Bookmark"
        className="text-[13px] transition-opacity hover:opacity-60"
        style={{ color: state.bookmarked ? "var(--accent)" : "var(--text-faint)" }}>
        {state.bookmarked ? "◼" : "◻"}
      </button>
    </div>
  );
}

// ── F1 per-round result components ────────────────────────────────────────────

function F1RaceResultsTable({ results }: { results: F1RaceResult[] }) {
  if (!results.length) return (
    <p className="py-6 text-center text-sm" style={{ color: "var(--text-faint)", fontFamily: "Syne, sans-serif" }}>
      No results available yet.
    </p>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]" style={{ fontFamily: "Syne, sans-serif", borderCollapse: "collapse", minWidth: 520 }}>
        <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
          {["Pos","Driver","Team","Grid","Laps","Time / Status","Pts"].map(h => (
            <th key={h} className="py-2 px-3 text-left text-[10px] font-semibold tracking-[0.1em] uppercase"
              style={{ color: "var(--text-faint)" }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>{results.map((r, i) => (
          <tr key={r.driver_id || i} className="transition-colors hover:bg-white/5"
            style={{ borderBottom: "1px solid var(--border)" }}>
            <td className="py-2 px-3 font-bold" style={{ color: i < 3 ? "var(--accent)" : "var(--text-faint)" }}>
              {r.position ?? "—"}
            </td>
            <td className="py-2 px-3 font-semibold" style={{ color: "var(--text-primary)" }}>
              {r.given_name} {r.family_name}
            </td>
            <td className="py-2 px-3" style={{ color: "var(--text-muted)" }}>{r.constructor || "—"}</td>
            <td className="py-2 px-3" style={{ color: "var(--text-muted)" }}>{r.grid ?? "—"}</td>
            <td className="py-2 px-3" style={{ color: "var(--text-muted)" }}>{r.laps ?? "—"}</td>
            <td className="py-2 px-3"
              style={{ color: r.status === "Finished" ? "var(--text-muted)" : r.time ? "var(--text-muted)" : "#ff9800" }}>
              {r.time || r.status || "—"}
            </td>
            <td className="py-2 px-3 font-bold"
              style={{ color: r.points > 0 ? "var(--accent)" : "var(--text-faint)" }}>
              {r.points > 0 ? r.points : "—"}
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function F1QualifyingTable({ results }: { results: F1QualifyingResult[] }) {
  if (!results.length) return (
    <p className="py-6 text-center text-sm" style={{ color: "var(--text-faint)", fontFamily: "Syne, sans-serif" }}>
      No qualifying data available yet.
    </p>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]" style={{ fontFamily: "Syne, sans-serif", borderCollapse: "collapse", minWidth: 480 }}>
        <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
          {["Pos","Driver","Team","Q1","Q2","Q3"].map(h => (
            <th key={h} className="py-2 px-3 text-left text-[10px] font-semibold tracking-[0.1em] uppercase"
              style={{ color: "var(--text-faint)" }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>{results.map((r, i) => (
          <tr key={r.driver_id || i} className="transition-colors hover:bg-white/5"
            style={{ borderBottom: "1px solid var(--border)" }}>
            <td className="py-2 px-3 font-bold" style={{ color: i < 3 ? "var(--accent)" : "var(--text-faint)" }}>
              {r.position ?? "—"}
            </td>
            <td className="py-2 px-3 font-semibold" style={{ color: "var(--text-primary)" }}>
              {r.given_name} {r.family_name}
            </td>
            <td className="py-2 px-3" style={{ color: "var(--text-muted)" }}>{r.constructor || "—"}</td>
            <td className="py-2 px-3 font-mono text-[11px]" style={{ color: r.q1 ? "var(--text-primary)" : "var(--text-faint)" }}>
              {r.q1 ?? "—"}
            </td>
            <td className="py-2 px-3 font-mono text-[11px]" style={{ color: r.q2 ? "var(--text-primary)" : "var(--text-faint)" }}>
              {r.q2 ?? "—"}
            </td>
            <td className="py-2 px-3 font-mono text-[11px]"
              style={{ color: i === 0 ? "var(--accent)" : r.q3 ? "var(--text-primary)" : "var(--text-faint)" }}>
              {r.q3 ?? "—"}
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function RaceDetailPanel({ season, round, isSprint }: { season: number; round: number; isSprint: boolean }) {
  const [tab, setTab]               = useState<RaceDetailTab>("race");
  const [raceResults, setRaceR]     = useState<F1RaceResult[]>([]);
  const [qualResults, setQualR]     = useState<F1QualifyingResult[]>([]);
  const [sprintResults, setSprintR] = useState<F1RaceResult[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    const fetches: Promise<unknown>[] = [
      fetchF1RaceResults(season, round),
      fetchF1QualifyingResults(season, round),
      ...(isSprint ? [fetchF1SprintResults(season, round)] : []),
    ];
    Promise.all(fetches)
      .then(([race, qual, sprint]) => {
        setRaceR(race as F1RaceResult[]);
        setQualR(qual as F1QualifyingResult[]);
        if (sprint) setSprintR(sprint as F1RaceResult[]);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [season, round, isSprint]);

  const detailTabs = [
    { key: "race"       as RaceDetailTab, label: "Race Results" },
    { key: "qualifying" as RaceDetailTab, label: "Qualifying" },
    ...(isSprint ? [{ key: "sprint" as RaceDetailTab, label: "Sprint" }] : []),
  ];

  return (
    <div className="py-4 px-4 my-1" style={{ background: "rgba(255,255,255,0.03)", borderRadius: 4 }}>
      <TabBar tabs={detailTabs} active={tab} onChange={setTab} />
      {loading ? <LoadingRow /> : error ? <ErrorRow msg={error} /> : (
        <>
          {tab === "race"       && <F1RaceResultsTable results={raceResults} />}
          {tab === "qualifying" && <F1QualifyingTable results={qualResults} />}
          {tab === "sprint"     && <F1RaceResultsTable results={sprintResults} />}
        </>
      )}
    </div>
  );
}

// ── F1 sub-components ─────────────────────────────────────────────────────────

function F1DriverTable({ drivers }: { drivers: F1Driver[] }) {
  if (!drivers.length) return <p className="py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>No data yet for {F1_SEASON}.</p>;
  return (
    <div className="overflow-x-auto">
    <table className="w-full text-[12px]" style={{ fontFamily: "Syne, sans-serif", borderCollapse: "collapse", minWidth: 360 }}>
      <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
        {["Pos","Driver","Team","Pts","W"].map(h => (
          <th key={h} className="py-2 px-3 text-left text-[10px] font-semibold tracking-[0.12em] uppercase"
            style={{ color: "var(--text-faint)" }}>{h}</th>
        ))}
      </tr></thead>
      <tbody>{drivers.map(d => (
        <tr key={d.driver_id} className="transition-colors hover:bg-white/5"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <td className="py-2.5 px-3" style={{ color: "var(--text-faint)" }}>{d.position}</td>
          <td className="py-2.5 px-3 font-semibold" style={{ color: "var(--text-primary)" }}>{d.given_name} {d.family_name}</td>
          <td className="py-2.5 px-3" style={{ color: "var(--text-muted)" }}>{d.constructor}</td>
          <td className="py-2.5 px-3 font-bold" style={{ color: "var(--accent)" }}>{d.points}</td>
          <td className="py-2.5 px-3" style={{ color: "var(--text-muted)" }}>{d.wins}</td>
        </tr>
      ))}</tbody>
    </table>
    </div>
  );
}

function F1ConstructorTable({ constructors }: { constructors: F1Constructor[] }) {
  if (!constructors.length) return <p className="py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>No data yet for {F1_SEASON}.</p>;
  return (
    <div className="overflow-x-auto">
    <table className="w-full text-[12px]" style={{ fontFamily: "Syne, sans-serif", borderCollapse: "collapse", minWidth: 360 }}>
      <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
        {["Pos","Team","Nationality","Pts","W"].map(h => (
          <th key={h} className="py-2 px-3 text-left text-[10px] font-semibold tracking-[0.12em] uppercase"
            style={{ color: "var(--text-faint)" }}>{h}</th>
        ))}
      </tr></thead>
      <tbody>{constructors.map(c => (
        <tr key={c.constructor_id} className="transition-colors hover:bg-white/5"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <td className="py-2.5 px-3" style={{ color: "var(--text-faint)" }}>{c.position}</td>
          <td className="py-2.5 px-3 font-semibold" style={{ color: "var(--text-primary)" }}>{c.name}</td>
          <td className="py-2.5 px-3" style={{ color: "var(--text-muted)" }}>{c.nationality}</td>
          <td className="py-2.5 px-3 font-bold" style={{ color: "var(--accent)" }}>{c.points}</td>
          <td className="py-2.5 px-3" style={{ color: "var(--text-muted)" }}>{c.wins}</td>
        </tr>
      ))}</tbody>
    </table>
    </div>
  );
}

// Session name → colour and short label
function sessionStyle(name: string): { color: string; badge: string } {
  const n = name.toLowerCase();
  if (n === "race")                                          return { color: "#e2001a", badge: "R" };
  if (n === "sprint")                                        return { color: "#ff9800", badge: "S" };
  if (n.includes("sprint qualifying") || n.includes("sprint shootout")) return { color: "#ffcc44", badge: "SQ" };
  if (n === "qualifying")                                    return { color: "var(--accent)", badge: "Q" };
  if (n.includes("practice 1"))                             return { color: "var(--text-faint)", badge: "FP1" };
  if (n.includes("practice 2"))                             return { color: "var(--text-faint)", badge: "FP2" };
  if (n.includes("practice 3"))                             return { color: "var(--text-faint)", badge: "FP3" };
  return { color: "var(--text-faint)", badge: name.slice(0, 3).toUpperCase() };
}

/** Convert a UTC datetime string ("YYYY-MM-DD HH:MM") to PKT (UTC+5, Asia/Karachi). */
function fmtPKT(utcStr: string | null): string {
  if (!utcStr) return "—";
  try {
    const d = new Date(utcStr.replace(" ", "T") + "Z");
    return d.toLocaleString("en-GB", {
      timeZone: "Asia/Karachi",
      weekday: "short",
      day:     "numeric",
      month:   "short",
      hour:    "2-digit",
      minute:  "2-digit",
    }) + " PKT";
  } catch { return utcStr; }
}

function formatLabel(fmt: string): string {
  const m: Record<string, string> = {
    conventional:      "Conventional",
    sprint:            "Sprint (legacy)",
    sprint_shootout:   "Sprint Shootout",
    sprint_qualifying: "Sprint Qualifying",
    testing:           "Testing",
  };
  return m[fmt] ?? fmt;
}

function CalendarExpanded({ r }: { r: F1Race }) {
  const [resultsTab, setResultsTab] = useState<"sessions" | "results">(r.is_past ? "sessions" : "sessions");

  return (
    <div className="px-3 py-4 space-y-5" style={{ background: "rgba(255,255,255,0.025)", borderRadius: "0 0 4px 4px" }}>

      {/* Event meta */}
      <div className="flex flex-wrap gap-x-8 gap-y-1">
        <div>
          <p className="text-[9px] font-semibold tracking-[0.2em] uppercase mb-0.5"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>Official Name</p>
          <p className="text-[11px]" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-primary)" }}>
            {r.official_name || r.event_name}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-semibold tracking-[0.2em] uppercase mb-0.5"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>Format</p>
          <p className="text-[11px]" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-muted)" }}>
            {formatLabel(r.format)}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-semibold tracking-[0.2em] uppercase mb-0.5"
            style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>F1 API</p>
          <p className="text-[11px]" style={{ fontFamily: "Syne, sans-serif", color: r.f1_api_support ? "#4caf50" : "var(--text-faint)" }}>
            {r.f1_api_support ? "✓ Supported" : "× Not available"}
          </p>
        </div>
      </div>

      {/* Tab selector if past race */}
      {r.is_past && (
        <div className="flex gap-1">
          {(["sessions", "results"] as const).map(t => (
            <button key={t} onClick={() => setResultsTab(t)}
              className="px-3 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase transition-colors"
              style={{
                fontFamily: "Syne, sans-serif",
                borderBottom: resultsTab === t ? "2px solid var(--accent)" : "2px solid transparent",
                color: resultsTab === t ? "var(--accent)" : "var(--text-faint)",
              }}>
              {t === "sessions" ? "Weekend Schedule" : "Race Results"}
            </button>
          ))}
        </div>
      )}

      {/* Session schedule */}
      {(resultsTab === "sessions" || !r.is_past) && (r.sessions?.length ?? 0) > 0 && (
        <div>
          {r.is_past && (
            <p className="text-[9px] font-semibold tracking-[0.2em] uppercase mb-2"
              style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
              Weekend Schedule
            </p>
          )}
          <div className="space-y-0">
            {(r.sessions ?? []).map((s, i) => {
              const { color, badge } = sessionStyle(s.name);
              const isPast = s.date_utc ? new Date(s.date_utc.replace(" ", "T") + "Z") < new Date() : r.is_past;
              return (
                <div key={i} className="flex items-start gap-3 py-2"
                  style={{ borderBottom: "1px solid var(--border)", opacity: isPast ? 0.7 : 1 }}>
                  {/* Badge */}
                  <span className="shrink-0 text-[9px] font-bold tracking-wider w-8 text-center pt-0.5"
                    style={{ color, fontFamily: "Syne, sans-serif" }}>
                    {badge}
                  </span>
                  {/* Name */}
                  <span className="text-[12px] font-semibold w-36 shrink-0"
                    style={{ color: "var(--text-primary)", fontFamily: "Syne, sans-serif" }}>
                    {s.name}
                  </span>
                  {/* PKT time */}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "Syne, sans-serif" }}>
                      {fmtPKT(s.date_utc)}
                    </span>
                  </div>
                  {/* Completed badge */}
                  {isPast && (
                    <span className="ml-auto text-[9px] shrink-0"
                      style={{ color: "#4caf50", fontFamily: "Syne, sans-serif" }}>✓</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Race results panel (past races only) */}
      {r.is_past && resultsTab === "results" && (
        <RaceDetailPanel season={F1_SEASON} round={r.round} isSprint={r.format.includes("sprint")} />
      )}
    </div>
  );
}

function F1Calendar({ races }: { races: F1Race[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  if (!races.length) return <p className="py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>No schedule.</p>;

  // Find the first upcoming race to highlight it
  const nextRound = races.find(r => !r.is_past)?.round ?? null;

  return (
    <div style={{ fontFamily: "Syne, sans-serif" }}>
      {races.map(r => {
        const isExpanded = expanded === r.round;
        const isNext = r.round === nextRound;
        return (
          <div key={r.round}
            className="transition-colors"
            style={{
              borderBottom: isExpanded ? "none" : "1px solid var(--border)",
              background: isNext ? "rgba(var(--accent-rgb),0.05)" : undefined,
            }}>
            {/* ── Main row ── */}
            <div
              className="flex items-center gap-0 hover:bg-white/5 transition-colors cursor-pointer"
              style={{ opacity: r.is_past ? 1 : 0.9 }}
              onClick={() => setExpanded(isExpanded ? null : r.round)}
            >
              {/* Round number */}
              <div className="w-10 shrink-0 py-3 pl-3 text-[11px] font-bold"
                style={{ color: r.is_past ? "var(--text-faint)" : "var(--accent)" }}>
                {r.round}
              </div>

              {/* Event name + format badges */}
              <div className="flex-1 py-3 px-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-semibold truncate"
                    style={{ color: isNext ? "var(--accent)" : "var(--text-primary)" }}>
                    {r.event_name}
                  </span>
                  {r.format.includes("sprint") && (
                    <span className="text-[8px] font-bold tracking-widest px-1.5 py-0.5 rounded-sm uppercase"
                      style={{ background: "rgba(255,152,0,0.15)", color: "#ff9800" }}>Sprint</span>
                  )}
                  {isNext && (
                    <span className="text-[8px] font-bold tracking-widest px-1.5 py-0.5 rounded-sm uppercase"
                      style={{ background: "rgba(var(--accent-rgb),0.15)", color: "var(--accent)" }}>Next</span>
                  )}
                  {r.is_past && (
                    <span className="text-[8px] tracking-widest"
                      style={{ color: "#4caf50" }}>✓</span>
                  )}
                </div>
                <p className="text-[10px] mt-0.5 truncate"
                  style={{ color: "var(--text-faint)" }}>
                  {r.location}, {r.country}
                </p>
              </div>

              {/* Session mini-badges */}
              <div className="hidden sm:flex items-center gap-1 px-3 shrink-0">
                {(r.sessions ?? []).map((s, i) => {
                  const { color, badge } = sessionStyle(s.name);
                  const done = s.date_utc
                    ? new Date(s.date_utc.replace(" ", "T") + "Z") < new Date()
                    : r.is_past;
                  return (
                    <span key={i} className="text-[9px] font-bold px-1 py-0.5 rounded-sm"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        color: done ? color : "var(--text-faint)",
                        border: "1px solid var(--border)",
                        opacity: done ? 1 : 0.5,
                      }}>
                      {badge}
                    </span>
                  );
                })}
              </div>

              {/* Date */}
              <div className="w-24 shrink-0 py-3 pr-2 text-right text-[11px] whitespace-nowrap"
                style={{ color: "var(--text-muted)" }}>
                {r.date}
              </div>

              {/* Expand indicator + tracking */}
              <div className="flex items-center gap-3 py-3 pr-3 shrink-0"
                onClick={e => e.stopPropagation()}>
                <RaceBtns raceKey={`${F1_SEASON}_${r.round}`} />
                <span className="text-[11px] w-3 text-center select-none"
                  style={{ color: "var(--text-faint)" }}
                  onClick={e => { e.stopPropagation(); setExpanded(isExpanded ? null : r.round); }}>
                  {isExpanded ? "▴" : "▾"}
                </span>
              </div>
            </div>

            {/* ── Expanded details ── */}
            {isExpanded && (
              <div style={{ borderBottom: "1px solid var(--border)" }}>
                <CalendarExpanded r={r} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── F1 Analytics (chart builder) ──────────────────────────────────────────────

const CHART_DEFS = [
  {
    key: "track-map",
    label: "Track Map",
    icon: "◯",
    desc: "Circuit outline with corner numbers",
    needsSession: true,
    needsDrivers: false,
    raceOnly: false,
    heavy: true,
  },
  {
    key: "speed-map",
    label: "Speed Map",
    icon: "◐",
    desc: "Speed gradient overlaid on track",
    needsSession: true,
    needsDrivers: true,
    singleDriver: true,
    raceOnly: false,
    heavy: true,
  },
  {
    key: "gear-map",
    label: "Gear Map",
    icon: "◑",
    desc: "Gear shifts visualised on track",
    needsSession: true,
    needsDrivers: false,
    raceOnly: false,
    heavy: true,
  },
  {
    key: "speed-trace",
    label: "Speed Trace",
    icon: "∿",
    desc: "Speed vs distance — compare up to 3 drivers",
    needsSession: true,
    needsDrivers: true,
    raceOnly: false,
    heavy: true,
  },
  {
    key: "position-changes",
    label: "Position Changes",
    icon: "↕",
    desc: "All driver positions over every race lap",
    needsSession: false,
    needsDrivers: false,
    raceOnly: true,
    heavy: false,
  },
  {
    key: "tyre-strategy",
    label: "Tyre Strategy",
    icon: "⊙",
    desc: "Stint & compound breakdown for every driver",
    needsSession: false,
    needsDrivers: false,
    raceOnly: true,
    heavy: false,
  },
  {
    key: "lap-times",
    label: "Lap Times",
    icon: "⊞",
    desc: "Lap time scatter with team colours",
    needsSession: true,
    needsDrivers: true,
    raceOnly: false,
    heavy: false,
  },
  {
    key: "team-pace",
    label: "Team Pace",
    icon: "⊟",
    desc: "Pace distribution box plot by team",
    needsSession: false,
    needsDrivers: false,
    raceOnly: true,
    heavy: false,
  },
] as const;

type ChartKey = (typeof CHART_DEFS)[number]["key"];

const VIZ_SESSIONS = [
  { key: "R",   label: "Race" },
  { key: "Q",   label: "Quali" },
  { key: "FP1", label: "FP1"  },
  { key: "FP2", label: "FP2"  },
  { key: "FP3", label: "FP3"  },
];

interface ActiveChart {
  id: string;
  key: ChartKey;
  label: string;
  image: string | null;
  loading: boolean;
  error: string | null;
}

function F1Analytics({ races, drivers }: { races: F1Race[]; drivers: F1Driver[] }) {
  const pastRaces = races.filter(r => r.is_past);
  const defaultRound = pastRaces.length ? pastRaces[pastRaces.length - 1].round : 1;

  const [round, setRound]             = useState<number>(defaultRound);
  const [session, setSession]         = useState("Q");
  const [selDrivers, setSelDrivers]   = useState<string[]>([]);
  const [activeCharts, setActiveCharts] = useState<ActiveChart[]>([]);

  // Derive abbreviation: prefer backend code field, fallback to first 3 of family name
  const driverAbbr = (d: F1Driver) =>
    (d.code && d.code.length >= 2 ? d.code : d.family_name.slice(0, 3).toUpperCase());

  const toggleDriver = (abbr: string) =>
    setSelDrivers(prev =>
      prev.includes(abbr)
        ? prev.filter(a => a !== abbr)
        : prev.length < 3 ? [...prev, abbr] : prev
    );

  const addChart = async (def: (typeof CHART_DEFS)[number]) => {
    const id = `${def.key}-${Date.now()}`;
    const entry: ActiveChart = { id, key: def.key, label: def.label, image: null, loading: true, error: null };
    setActiveCharts(prev => [...prev, entry]);

    try {
      const params: Record<string, string | number> = { season: F1_SEASON, round };
      if (def.needsSession) params.session = def.raceOnly ? "R" : session;
      if (def.needsDrivers && selDrivers.length) {
        // speed-map uses single `driver` param; others use `drivers`
        if ("singleDriver" in def && def.singleDriver) params.driver = selDrivers[0];
        else params.drivers = selDrivers.join(",");
      }
      const data = await fetchF1Chart(def.key, params);
      setActiveCharts(prev =>
        prev.map(c => c.id === id ? { ...c, image: data.image, loading: false } : c)
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setActiveCharts(prev =>
        prev.map(c => c.id === id ? { ...c, loading: false, error: msg } : c)
      );
    }
  };

  const removeChart = (id: string) =>
    setActiveCharts(prev => prev.filter(c => c.id !== id));

  const currentRace = pastRaces.find(r => r.round === round);

  return (
    <div>
      {/* ── Controls ── */}
      <div className="space-y-5 mb-7">

        {/* Round picker */}
        <div>
          <SectionLabel>Round</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {pastRaces.map(r => (
              <Pill
                key={r.round}
                label={`R${r.round} · ${r.event_name.split(" ").slice(-1)[0]}`}
                active={round === r.round}
                onClick={() => setRound(r.round)}
              />
            ))}
            {!pastRaces.length && (
              <span className="text-[11px]" style={{ color: "var(--text-faint)", fontFamily: "Syne, sans-serif" }}>
                No completed rounds yet for {F1_SEASON}.
              </span>
            )}
          </div>
        </div>

        {/* Session picker (used by telemetry + lap-time charts) */}
        <div>
          <SectionLabel>Session (for telemetry & lap-time charts)</SectionLabel>
          <div className="flex gap-1.5 flex-wrap">
            {VIZ_SESSIONS.map(s => (
              <Pill key={s.key} label={s.label} active={session === s.key} onClick={() => setSession(s.key)} />
            ))}
          </div>
        </div>

        {/* Driver multi-select */}
        <div>
          <SectionLabel>Compare Drivers — max 3 (Speed Trace, Lap Times, Speed Map)</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {drivers.map(d => {
              const abbr = driverAbbr(d);
              return (
                <button
                  key={d.driver_id}
                  onClick={() => toggleDriver(abbr)}
                  className="px-2.5 py-1 text-[10px] font-semibold tracking-[0.1em] uppercase rounded-sm transition-all"
                  style={{
                    fontFamily: "Syne, sans-serif",
                    background: selDrivers.includes(abbr) ? "var(--accent-dim)" : "transparent",
                    color: selDrivers.includes(abbr) ? "var(--accent)" : "var(--text-muted)",
                    border: "1px solid",
                    borderColor: selDrivers.includes(abbr) ? "var(--accent-border)" : "var(--border)",
                  }}
                >
                  {abbr}
                  <span className="ml-1 text-[8px] opacity-60">
                    {d.family_name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Current round info ── */}
      {currentRace && (
        <p className="text-[10px] mb-5 italic"
          style={{ color: "var(--text-faint)", fontFamily: "Syne, sans-serif" }}>
          {currentRace.event_name} · {currentRace.date} · {currentRace.location}, {currentRace.country}
          {currentRace.format.includes("sprint") && (
            <span className="ml-2 px-1 text-[9px] rounded" style={{ background: "rgba(var(--accent-rgb),0.15)", color: "var(--accent)" }}>Sprint Weekend</span>
          )}
        </p>
      )}

      {/* ── Chart picker grid ── */}
      <div className="mb-7">
        <SectionLabel>Add Chart — click to generate</SectionLabel>
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
          {CHART_DEFS.map(def => (
            <button
              key={def.key}
              onClick={() => addChart(def)}
              className="text-left p-3 rounded-sm transition-all hover:bg-white/5 active:scale-[0.98]"
              style={{ border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: "var(--accent)", fontSize: 15, lineHeight: 1 }}>{def.icon}</span>
                <span className="text-[11px] font-semibold" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-primary)" }}>
                  {def.label}
                </span>
                {def.heavy && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded-sm ml-auto"
                    style={{ background: "rgba(255,165,0,0.12)", color: "#ff9800", fontFamily: "Syne, sans-serif" }}>
                    slow
                  </span>
                )}
              </div>
              <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-faint)", fontFamily: "Syne, sans-serif" }}>
                {def.desc}
              </p>
              {def.raceOnly && (
                <p className="text-[9px] mt-1" style={{ color: "var(--text-faint)", fontFamily: "Syne, sans-serif" }}>
                  Race only
                </p>
              )}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[10px]" style={{ color: "var(--text-faint)", fontFamily: "Syne, sans-serif" }}>
          <span style={{ color: "#ff9800" }}>slow</span> charts load full telemetry (30–120 s first time, cached after).
          Results and position-change charts are fast.
        </p>
      </div>

      {/* ── Generated chart grid ── */}
      {activeCharts.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: "var(--text-faint)", fontFamily: "Syne, sans-serif" }}>
          Select a round, session and drivers above, then click any chart card.
        </p>
      ) : (
        <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
          {activeCharts.map(chart => (
            <div key={chart.id} style={{ border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
              {/* Card header */}
              <div className="flex items-center justify-between px-3 py-2"
                style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                <span className="text-[11px] font-semibold tracking-[0.1em] uppercase"
                  style={{ color: "var(--text-muted)", fontFamily: "Syne, sans-serif" }}>
                  {chart.label}
                </span>
                <button onClick={() => removeChart(chart.id)}
                  className="text-[13px] transition-opacity hover:opacity-50"
                  style={{ color: "var(--text-faint)" }}>
                  ✕
                </button>
              </div>
              {/* Content */}
              {chart.loading && (
                <div className="flex flex-col items-center gap-3 py-12">
                  <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "var(--text-faint)", borderTopColor: "transparent" }} />
                  <span className="text-[10px]" style={{ color: "var(--text-faint)", fontFamily: "Syne, sans-serif" }}>
                    Generating chart…
                  </span>
                </div>
              )}
              {chart.error && <ErrorRow msg={chart.error} />}
              {chart.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/png;base64,${chart.image}`}
                  alt={chart.label}
                  className="w-full block"
                  style={{ imageRendering: "auto" }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function F1Section() {
  const [tab, setTab]       = useState<F1Tab>("drivers");
  const [drivers, setD]     = useState<F1Driver[]>([]);
  const [constr, setC]      = useState<F1Constructor[]>([]);
  const [races, setR]       = useState<F1Race[]>([]);
  const [loading, setL]     = useState(true);
  const [error, setE]       = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchF1DriverStandings(F1_SEASON),
      fetchF1ConstructorStandings(F1_SEASON),
      fetchF1Schedule(F1_SEASON),
    ]).then(([d, c, r]) => { setD(d); setC(c); setR(r); })
      .catch(e => setE(e.message)).finally(() => setL(false));
  }, []);

  const lastRace = useMemo(() => {
    const past = races.filter(r => r.is_past);
    return past.length ? past[past.length - 1] : null;
  }, [races]);

  const f1Tabs = [
    { key: "drivers"      as F1Tab, label: "Drivers" },
    { key: "constructors" as F1Tab, label: "Constructors" },
    { key: "calendar"     as F1Tab, label: "Calendar" },
    { key: "latest"       as F1Tab, label: "Latest Race" },
    { key: "analytics"    as F1Tab, label: "Analytics" },
  ];

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-5">
        <h3 className="text-lg font-bold italic" style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}>
          Formula 1 · {F1_SEASON}
        </h3>
        {drivers.length > 0 && <span className="text-[10px] tracking-widest uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>{drivers.length} drivers</span>}
      </div>
      <TabBar tabs={f1Tabs} active={tab} onChange={setTab} />
      {loading ? <LoadingRow /> : error ? <ErrorRow msg={error} /> : (
        <>
          {tab === "drivers"      && <F1DriverTable drivers={drivers} />}
          {tab === "constructors" && <F1ConstructorTable constructors={constr} />}
          {tab === "calendar"     && <F1Calendar races={races} />}
          {tab === "analytics"    && <F1Analytics races={races} drivers={drivers} />}
          {tab === "latest"       && (
            lastRace ? (
              <div>
                <div className="flex items-baseline gap-3 mb-4">
                  <p className="text-base font-semibold italic"
                    style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}>
                    Round {lastRace.round} · {lastRace.event_name}
                  </p>
                  <span className="text-[10px] tracking-widest uppercase"
                    style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
                    {lastRace.date}
                  </span>
                </div>
                <RaceDetailPanel season={F1_SEASON} round={lastRace.round} isSprint={lastRace.format.includes("sprint")} />
              </div>
            ) : (
              <p className="py-8 text-center text-sm" style={{ color: "var(--text-faint)", fontFamily: "Syne, sans-serif" }}>
                No completed races yet for {F1_SEASON}.
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}

// ── Football sub-components ───────────────────────────────────────────────────

function StandingsTable({ entries }: { entries: FDStandingEntry[] }) {
  if (!entries.length) return <p className="py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>No standings data.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]" style={{ fontFamily: "Syne, sans-serif", borderCollapse: "collapse", minWidth: 560 }}>
        <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
          {["#","Team","P","W","D","L","GF","GA","GD","Pts","Form"].map(h => (
            <th key={h} className="py-2 px-2 text-left text-[10px] font-semibold tracking-[0.1em] uppercase"
              style={{ color: "var(--text-faint)" }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>{entries.map(s => {
          const liv = isLiv(s.team.name);
          return (
            <tr key={s.team.id} className="transition-colors hover:bg-white/5"
              style={{ borderBottom: "1px solid var(--border)", background: liv ? "rgba(200,16,46,0.07)" : undefined }}>
              <td className="py-2.5 px-2" style={{ color: "var(--text-faint)" }}>{s.position}</td>
              <td className="py-2.5 px-2 font-semibold" style={{ color: liv ? "#e2001a" : "var(--text-primary)" }}>{s.team.shortName || s.team.name}</td>
              <td className="py-2.5 px-2" style={{ color: "var(--text-muted)" }}>{s.playedGames}</td>
              <td className="py-2.5 px-2" style={{ color: "var(--text-muted)" }}>{s.won}</td>
              <td className="py-2.5 px-2" style={{ color: "var(--text-muted)" }}>{s.draw}</td>
              <td className="py-2.5 px-2" style={{ color: "var(--text-muted)" }}>{s.lost}</td>
              <td className="py-2.5 px-2" style={{ color: "var(--text-muted)" }}>{s.goalsFor}</td>
              <td className="py-2.5 px-2" style={{ color: "var(--text-muted)" }}>{s.goalsAgainst}</td>
              <td className="py-2.5 px-2" style={{ color: s.goalDifference > 0 ? "#4caf50" : s.goalDifference < 0 ? "#e05" : "var(--text-muted)" }}>
                {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
              </td>
              <td className="py-2.5 px-2 font-bold" style={{ color: liv ? "#e2001a" : "var(--accent)" }}>{s.points}</td>
              <td className="py-2.5 px-2 tracking-[0.05em]">
                {(s.form ?? "").split("").map((ch, i) => <FormChar key={i} ch={ch} />)}
              </td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function MultiGroupStandings({ groups }: { groups: FDStandingGroup[] }) {
  if (!groups.length) return <p className="py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>No standings data.</p>;
  // If only one group or type=TOTAL, show flat table
  const total = groups.find(g => g.type === "TOTAL");
  if (total) return <StandingsTable entries={total.table} />;
  // Multiple groups (e.g. WC group stage)
  return (
    <div className="space-y-6">
      {groups.map((g, i) => (
        <div key={i}>
          <SectionLabel>{g.group ?? g.stage}</SectionLabel>
          <StandingsTable entries={g.table} />
        </div>
      ))}
    </div>
  );
}

function ScorersTable({ scorers }: { scorers: FDScorer[] }) {
  if (!scorers.length) return <p className="py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>No scorer data.</p>;
  return (
    <div className="overflow-x-auto">
    <table className="w-full text-[12px]" style={{ fontFamily: "Syne, sans-serif", borderCollapse: "collapse", minWidth: 420 }}>
      <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
        {["#","Player","Team","Goals","Assists","Pen","Apps"].map(h => (
          <th key={h} className="py-2 px-3 text-left text-[10px] font-semibold tracking-[0.12em] uppercase"
            style={{ color: "var(--text-faint)" }}>{h}</th>
        ))}
      </tr></thead>
      <tbody>{scorers.map((s, i) => {
        const liv = isLiv(s.team?.name ?? "");
        return (
          <tr key={s.player.id} className="transition-colors hover:bg-white/5"
            style={{ borderBottom: "1px solid var(--border)", background: liv ? "rgba(200,16,46,0.07)" : undefined }}>
            <td className="py-2.5 px-3" style={{ color: "var(--text-faint)" }}>{i + 1}</td>
            <td className="py-2.5 px-3 font-semibold" style={{ color: liv ? "#e2001a" : "var(--text-primary)" }}>{s.player.name}</td>
            <td className="py-2.5 px-3" style={{ color: "var(--text-muted)" }}>{s.team?.shortName || s.team?.name || "—"}</td>
            <td className="py-2.5 px-3 font-bold" style={{ color: "var(--accent)" }}>{s.goals ?? 0}</td>
            <td className="py-2.5 px-3" style={{ color: "var(--text-muted)" }}>{s.assists ?? 0}</td>
            <td className="py-2.5 px-3" style={{ color: "var(--text-muted)" }}>{s.penalties ?? 0}</td>
            <td className="py-2.5 px-3" style={{ color: "var(--text-muted)" }}>{s.playedMatches ?? 0}</td>
          </tr>
        );
      })}</tbody>
    </table>
    </div>
  );
}

function MatchRow({ m, showComp = false }: { m: FDMatch; showComp?: boolean }) {
  const status  = m.status;
  const finished = ["FINISHED", "AWARDED"].includes(status);
  const live    = ["IN_PLAY", "PAUSED"].includes(status);
  const homeIsLiv = isLiv(m.homeTeam?.name ?? "");
  const awayIsLiv = isLiv(m.awayTeam?.name ?? "");
  const scoreStr = finished
    ? `${m.score.fullTime.home ?? 0} – ${m.score.fullTime.away ?? 0}`
    : live ? `${m.score.fullTime.home ?? 0} – ${m.score.fullTime.away ?? 0}`
    : fmtTime(m.utcDate);

  return (
    <tr className="transition-colors hover:bg-white/5" style={{ borderBottom: "1px solid var(--border)" }}>
      <td className="py-2 px-3 whitespace-nowrap text-[11px]" style={{ color: "var(--text-faint)" }}>
        {fmtDate(m.utcDate)}
        {showComp && m.competition && (
          <span className="ml-2 text-[9px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>
            {m.competition.code}
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-right font-semibold text-[12px]" style={{ color: homeIsLiv ? "#e2001a" : "var(--text-primary)" }}>
        {m.homeTeam?.shortName || m.homeTeam?.name}
      </td>
      <td className="py-2 px-3 text-center font-bold text-[12px] w-20"
        style={{ color: finished || live ? "var(--text-primary)" : "var(--text-muted)" }}>
        {scoreStr}
      </td>
      <td className="py-2 px-3 text-left font-semibold text-[12px]" style={{ color: awayIsLiv ? "#e2001a" : "var(--text-primary)" }}>
        {m.awayTeam?.shortName || m.awayTeam?.name}
      </td>
      <td className="py-2 px-3 text-[9px] font-semibold tracking-widest uppercase whitespace-nowrap"
        style={{ color: statusColor(status) }}>
        {statusLabel(status)}{live ? " ●" : ""}
      </td>
      {m.matchday && (
        <td className="py-2 px-3 text-[10px]" style={{ color: "var(--text-faint)" }}>MD{m.matchday}</td>
      )}
      <td className="py-2 px-3"><MatchBtns matchId={String(m.id)} /></td>
    </tr>
  );
}

function MatchesTable({ matches, filter, showComp = false }: { matches: FDMatch[]; filter: MFilter; showComp?: boolean }) {
  const now = Date.now();
  const visible = useMemo(() => {
    if (filter === "results")  return matches.filter(m => ["FINISHED","AWARDED"].includes(m.status));
    if (filter === "upcoming") return matches.filter(m => ["SCHEDULED","TIMED","POSTPONED"].includes(m.status));
    return matches;
  }, [matches, filter]);

  if (!visible.length) return <p className="py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>No matches to show.</p>;
  void now;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]" style={{ fontFamily: "Syne, sans-serif", borderCollapse: "collapse", minWidth: 500 }}>
        <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
          {["Date","Home","Score / KO","Away","Status","MD",""].map((h,i) => (
            <th key={i} className="py-2 px-3 text-left text-[10px] font-semibold tracking-[0.1em] uppercase"
              style={{ color: "var(--text-faint)" }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>{visible.map(m => <MatchRow key={m.id} m={m} showComp={showComp} />)}</tbody>
      </table>
    </div>
  );
}

// ── Football section ──────────────────────────────────────────────────────────

function CompetitionSelector({ selected, onSelect }: { selected: string; onSelect: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-6">
      {COMPETITIONS.map(c => (
        <Pill key={c.code} label={c.name} active={selected === c.code} onClick={() => onSelect(c.code)} />
      ))}
    </div>
  );
}

function CompetitionData({ code }: { code: string }) {
  const [tab, setTab]           = useState<FBTab>("standings");
  const [standData, setStand]   = useState<unknown>(null);
  const [scorersData, setScore] = useState<unknown>(null);
  const [matchData, setMatch]   = useState<unknown>(null);
  const [loading, setLoad]      = useState(true);
  const [error, setErr]         = useState<string | null>(null);
  const [mFilter, setMFilter]   = useState<MFilter>("all");

  useEffect(() => {
    setLoad(true); setErr(null);
    setStand(null); setScore(null); setMatch(null);
    Promise.all([
      fetchFootballStandings(code),
      fetchFootballScorers(code, 20),
      fetchFootballMatches(code),
    ]).then(([s, sc, m]) => { setStand(s); setScore(sc); setMatch(m); })
      .catch(e => setErr(e.message)).finally(() => setLoad(false));
  }, [code]);

  const standings = useMemo(() => parseStandingGroups(standData), [standData]);
  const scorers   = useMemo(() => parseScorers(scorersData), [scorersData]);
  const matches   = useMemo(() => parseMatches(matchData), [matchData]);
  const season    = useMemo(() => parseSeasonLabel(standData), [standData]);

  const fbTabs = [
    { key: "standings" as FBTab, label: "Standings" },
    { key: "scorers"   as FBTab, label: "Top Scorers" },
    { key: "matches"   as FBTab, label: "Matches" },
  ];

  const comp = COMPETITIONS.find(c => c.code === code);

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-5">
        <h3 className="text-lg font-bold italic" style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}>
          {comp?.name ?? code}
        </h3>
        {season && <span className="text-[10px] tracking-widest uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>{season}</span>}
        {standings[0]?.table?.length > 0 && <span className="text-[10px]" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>{standings[0].table.length} teams</span>}
      </div>
      <TabBar tabs={fbTabs} active={tab} onChange={setTab} />

      {tab === "matches" && (
        <div className="flex gap-2 mb-4">
          {(["all","results","upcoming"] as MFilter[]).map(f => (
            <Pill key={f} label={f === "all" ? "All" : f === "results" ? "Results" : "Upcoming"}
              active={mFilter === f} onClick={() => setMFilter(f)} />
          ))}
          <span className="ml-2 text-[10px] self-center" style={{ color: "var(--text-faint)", fontFamily: "Syne, sans-serif" }}>
            {matches.length} matches
          </span>
        </div>
      )}

      {loading ? <LoadingRow /> : error ? <ErrorRow msg={error} /> : (
        <>
          {tab === "standings" && <MultiGroupStandings groups={standings} />}
          {tab === "scorers"   && <ScorersTable scorers={scorers} />}
          {tab === "matches"   && <MatchesTable matches={matches} filter={mFilter} />}
        </>
      )}
    </div>
  );
}

function FootballSection() {
  const [selected, setSelected] = useState("PL");
  return (
    <div>
      <CompetitionSelector selected={selected} onSelect={setSelected} />
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
        <CompetitionData code={selected} />
      </div>
    </div>
  );
}

// ── Liverpool FC section ──────────────────────────────────────────────────────

function LiverpoolSection() {
  const [tab, setTab]             = useState<LivTab>("results");
  const [results, setResults]     = useState<FDMatch[]>([]);
  const [upcoming, setUpcoming]   = useState<FDMatch[]>([]);
  const [loadR, setLoadR]         = useState(true);
  const [loadU, setLoadU]         = useState(true);
  const [errR, setErrR]           = useState<string | null>(null);
  const [errU, setErrU]           = useState<string | null>(null);

  useEffect(() => {
    fetchTeamMatches(LIVERPOOL_ID, "FINISHED", 20)
      .then(d => setResults(parseMatches(d).reverse())) // most recent first
      .catch(e => setErrR(e.message))
      .finally(() => setLoadR(false));
    fetchTeamMatches(LIVERPOOL_ID, "SCHEDULED", 15)
      .then(d => setUpcoming(parseMatches(d)))
      .catch(e => setErrU(e.message))
      .finally(() => setLoadU(false));
  }, []);

  const livTabs = [
    { key: "results"  as LivTab, label: "Recent Results" },
    { key: "upcoming" as LivTab, label: "Upcoming" },
    { key: "history"  as LivTab, label: "UCL History" },
  ];

  const wins = LIV_FINALS.filter(f => f.result === "winner").length;

  return (
    <div>
      {/* Hero row */}
      <div className="flex items-baseline gap-4 mb-7">
        <h3 className="text-2xl font-bold italic" style={{ fontFamily: "Cormorant, Georgia, serif", color: "#e2001a" }}>
          Liverpool FC
        </h3>
        <span className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
          Est. 1892
        </span>
        <span className="text-[11px] tracking-widest uppercase" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
          · {wins}× European Champions
        </span>
      </div>

      <TabBar tabs={livTabs} active={tab} onChange={setTab} />

      {tab === "results" && (
        loadR ? <LoadingRow /> : errR ? <ErrorRow msg={errR} /> : (
          <MatchesTable matches={results} filter="all" showComp />
        )
      )}

      {tab === "upcoming" && (
        loadU ? <LoadingRow /> : errU ? <ErrorRow msg={errU} /> : (
          upcoming.length ? <MatchesTable matches={upcoming} filter="all" showComp /> :
          <p className="py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>No upcoming fixtures found.</p>
        )
      )}

      {tab === "history" && (
        <div>
          <div className="flex items-baseline gap-4 mb-5">
            <span className="text-[36px] font-bold italic" style={{ fontFamily: "Cormorant, Georgia, serif", color: "#e2001a" }}>
              {wins}×
            </span>
            <div>
              <p className="text-sm font-semibold" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-primary)" }}>
                UEFA Champions League Winners
              </p>
              <p className="text-[11px]" style={{ fontFamily: "Syne, sans-serif", color: "var(--text-faint)" }}>
                1977, 1978, 1981, 1984, 2005, 2019 · {LIV_FINALS.length} finals total
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-[12px]" style={{ fontFamily: "Syne, sans-serif", borderCollapse: "collapse", minWidth: 400 }}>
            <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Year","Opponent","Score","Venue"].map(h => (
                <th key={h} className="py-2 px-3 text-left text-[10px] font-semibold tracking-[0.12em] uppercase"
                  style={{ color: "var(--text-faint)" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{LIV_FINALS.map(f => (
              <tr key={f.year} className="transition-colors hover:bg-white/5"
                style={{ borderBottom: "1px solid var(--border)", background: f.result === "winner" ? "rgba(200,16,46,0.07)" : undefined }}>
                <td className="py-2.5 px-3 font-bold" style={{ color: f.result === "winner" ? "#e2001a" : "var(--text-faint)" }}>{f.year}</td>
                <td className="py-2.5 px-3 font-semibold" style={{ color: "var(--text-primary)" }}>{f.opponent}</td>
                <td className="py-2.5 px-3 font-semibold" style={{ color: f.result === "winner" ? "#4caf50" : "#e05" }}>{f.score}</td>
                <td className="py-2.5 px-3" style={{ color: "var(--text-muted)" }}>{f.venue}</td>
              </tr>
            ))}</tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sport selector + main ─────────────────────────────────────────────────────

const SPORTS: { key: Sport; label: string; icon: string }[] = [
  { key: "f1",        label: "Formula 1",       icon: "⊛" },
  { key: "football",  label: "Football",         icon: "⊕" },
  { key: "liverpool", label: "Liverpool FC",     icon: "◑" },
];

export default function SportsPage() {
  const [sport, setSport] = useState<Sport>("f1");

  return (
    <div className="px-4 sm:px-8 py-4 sm:py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8 pb-6 border-b" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-3xl font-bold italic mb-5"
          style={{ fontFamily: "Cormorant, Georgia, serif", color: "var(--text-primary)" }}>
          Sports Hub
        </h2>
        <div className="flex gap-2 flex-wrap">
          {SPORTS.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setSport(key)}
              className="flex items-center gap-2 px-4 py-2 text-[11px] font-semibold tracking-[0.15em] uppercase transition-all rounded-sm"
              style={{
                fontFamily: "Syne, sans-serif",
                background: sport === key ? "var(--accent-dim)" : "transparent",
                color: sport === key ? "var(--accent)" : "var(--text-muted)",
                border: "1px solid",
                borderColor: sport === key ? "var(--accent-border)" : "var(--border)",
              }}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      {sport === "f1"        && <F1Section />}
      {sport === "football"  && <FootballSection />}
      {sport === "liverpool" && <LiverpoolSection />}
    </div>
  );
}
