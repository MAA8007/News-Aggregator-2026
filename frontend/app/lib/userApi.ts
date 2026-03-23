const BASE = "http://localhost:8000";
const TOKEN_KEY = "newsagg_auth_token";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface ServerMovieState {
  movie_ranking: number;
  watched: boolean;
  in_list: boolean;
  bookmarked: boolean;
}

export interface ServerBookState {
  book_ranking: number;
  read: boolean;
  in_list: boolean;
  bookmarked: boolean;
}

export interface ServerCustomMovie {
  id: number;
  client_ranking: number;
  title: string;
  director: string;
  year: number;
  overall_score: number;
  description: string;
  genre: string;
}

export interface ServerCustomBook {
  id: number;
  client_ranking: number;
  title: string;
  author: string;
  year: number;
  year_display: string;
  read_time: string;
  description: string;
}

// ── Token helpers ─────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: authHeaders(),
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function apiSignup(username: string, email: string, password: string): Promise<TokenResponse> {
  return apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
}

export async function apiLogin(email: string, password: string): Promise<TokenResponse> {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function apiMe(): Promise<AuthUser> {
  return apiFetch("/auth/me");
}

// ── Movie states ──────────────────────────────────────────────────────────────

export async function apiGetMovieStates(): Promise<ServerMovieState[]> {
  return apiFetch("/user/movies/states");
}

export async function apiUpsertMovieState(
  ranking: number,
  state: { watched: boolean; in_list: boolean; bookmarked: boolean },
): Promise<ServerMovieState> {
  return apiFetch(`/user/movies/states/${ranking}`, {
    method: "PUT",
    body: JSON.stringify(state),
  });
}

export async function apiBulkSyncMovieStates(
  states: Record<number, { watched: boolean; in_list: boolean; bookmarked: boolean }>,
): Promise<ServerMovieState[]> {
  return apiFetch("/user/movies/states/bulk", {
    method: "POST",
    body: JSON.stringify({ states }),
  });
}

// ── Book states ───────────────────────────────────────────────────────────────

export async function apiGetBookStates(): Promise<ServerBookState[]> {
  return apiFetch("/user/books/states");
}

export async function apiUpsertBookState(
  ranking: number,
  state: { read: boolean; in_list: boolean; bookmarked: boolean },
): Promise<ServerBookState> {
  return apiFetch(`/user/books/states/${ranking}`, {
    method: "PUT",
    body: JSON.stringify(state),
  });
}

export async function apiBulkSyncBookStates(
  states: Record<number, { read: boolean; in_list: boolean; bookmarked: boolean }>,
): Promise<ServerBookState[]> {
  return apiFetch("/user/books/states/bulk", {
    method: "POST",
    body: JSON.stringify({ states }),
  });
}

// ── Custom movies ─────────────────────────────────────────────────────────────

export async function apiGetCustomMovies(): Promise<ServerCustomMovie[]> {
  return apiFetch("/user/movies/custom");
}

export async function apiAddCustomMovie(movie: Omit<ServerCustomMovie, "id">): Promise<ServerCustomMovie> {
  return apiFetch("/user/movies/custom", {
    method: "POST",
    body: JSON.stringify(movie),
  });
}

export async function apiDeleteCustomMovie(clientRanking: number): Promise<void> {
  return apiFetch(`/user/movies/custom/${clientRanking}`, { method: "DELETE" });
}

// ── Custom books ──────────────────────────────────────────────────────────────

export async function apiGetCustomBooks(): Promise<ServerCustomBook[]> {
  return apiFetch("/user/books/custom");
}

export async function apiAddCustomBook(book: Omit<ServerCustomBook, "id">): Promise<ServerCustomBook> {
  return apiFetch("/user/books/custom", {
    method: "POST",
    body: JSON.stringify(book),
  });
}

export async function apiDeleteCustomBook(clientRanking: number): Promise<void> {
  return apiFetch(`/user/books/custom/${clientRanking}`, { method: "DELETE" });
}
