"use client";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── F1 types ──────────────────────────────────────────────────────────────────

export interface F1Driver {
  position: number; points: number; wins: number;
  driver_id: string; given_name: string; family_name: string;
  nationality: string; constructor: string;
  code?: string;  // 3-letter abbreviation e.g. "VER"
}

export interface F1Constructor {
  position: number; points: number; wins: number;
  constructor_id: string; name: string; nationality: string;
}

export interface F1SessionInfo {
  name: string;
  date_local: string | null;
  date_utc: string | null;
}

export interface F1Race {
  round: number;
  event_name: string;
  official_name: string;
  country: string;
  location: string;
  date: string;
  format: string;
  is_past: boolean;
  f1_api_support: boolean;
  sessions: F1SessionInfo[];
}

// ── football-data.org types ───────────────────────────────────────────────────

export interface FDTeam {
  id: number;
  name: string;
  shortName: string;
  crest: string;
}

export interface FDStandingEntry {
  position: number;
  team: FDTeam;
  playedGames: number;
  form: string | null;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface FDStandingGroup {
  stage: string;
  type: string;
  group: string | null;
  table: FDStandingEntry[];
}

export interface FDScorer {
  player: { id: number; name: string; nationality: string };
  team: FDTeam;
  goals: number;
  assists: number | null;
  penalties: number | null;
  playedMatches: number;
}

export interface FDMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  stage: string;
  group: string | null;
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration: string;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  competition?: { id: number; name: string; code: string; emblem: string };
}

// ── Parsers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseStandings(data: any): FDStandingEntry[] {
  const groups: FDStandingGroup[] = data?.standings ?? [];
  const total = groups.find((s) => s.type === "TOTAL");
  return total?.table ?? groups[0]?.table ?? [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseStandingGroups(data: any): FDStandingGroup[] {
  return data?.standings ?? [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseScorers(data: any): FDScorer[] {
  return data?.scorers ?? [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseMatches(data: any): FDMatch[] {
  return [...(data?.matches ?? [])].sort(
    (a: FDMatch, b: FDMatch) =>
      new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseSeasonLabel(data: any): string {
  const s = data?.season;
  if (!s) return "";
  if (s.startDate && s.endDate) {
    return `${s.startDate.slice(0, 4)}/${s.endDate.slice(2, 4)}`;
  }
  return "";
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function get(path: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

// F1
export const fetchF1DriverStandings    = (season = 2026) => get(`/sports/f1/driver-standings?season=${season}`) as Promise<F1Driver[]>;
export const fetchF1ConstructorStandings = (season = 2026) => get(`/sports/f1/constructor-standings?season=${season}`) as Promise<F1Constructor[]>;
export const fetchF1Schedule           = (season = 2026) => get(`/sports/f1/schedule?season=${season}`) as Promise<F1Race[]>;

// Football — generic competition
export const fetchFootballStandings = (competition: string) => get(`/sports/football/standings?competition=${competition}`);
export const fetchFootballScorers   = (competition: string, limit = 20) => get(`/sports/football/scorers?competition=${competition}&limit=${limit}`);
export const fetchFootballMatches   = (competition: string) => get(`/sports/football/matches?competition=${competition}`);

// ── F1 per-round result types ─────────────────────────────────────────────────

export interface F1RaceResult {
  position: number | null;
  points: number;
  grid: number | null;
  laps: number | null;
  status: string;
  time: string;
  driver_id: string;
  given_name: string;
  family_name: string;
  constructor: string;
}

export interface F1QualifyingResult {
  position: number | null;
  driver_id: string;
  given_name: string;
  family_name: string;
  constructor: string;
  q1: string | null;
  q2: string | null;
  q3: string | null;
}

export const fetchF1RaceResults      = (season: number, round: number) => get(`/sports/f1/race-results?season=${season}&round=${round}`) as Promise<F1RaceResult[]>;
export const fetchF1QualifyingResults = (season: number, round: number) => get(`/sports/f1/qualifying-results?season=${season}&round=${round}`) as Promise<F1QualifyingResult[]>;
export const fetchF1SprintResults    = (season: number, round: number) => get(`/sports/f1/sprint-results?season=${season}&round=${round}`) as Promise<F1RaceResult[]>;

// ── F1 visualisation (base64 PNG charts) ─────────────────────────────────────

export interface F1Chart { image: string; title: string; }

export function fetchF1Chart(
  type: string,
  params: Record<string, string | number>,
): Promise<F1Chart> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  return get(`/sports/f1/viz/${type}?${qs}`) as Promise<F1Chart>;
}

// Football — team-specific (Liverpool = 64)
export const fetchTeamMatches = (teamId: number, status?: string, limit = 15) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.append("status", status);
  return get(`/sports/football/team/${teamId}/matches?${params}`);
};
