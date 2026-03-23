"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  type AuthUser,
  apiLogin,
  apiMe,
  apiSignup,
  apiBulkSyncMovieStates,
  apiBulkSyncBookStates,
  clearToken,
  getToken,
  setToken,
} from "@/app/lib/userApi";
import { setUserScope } from "@/app/lib/userScope";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  authModalOpen: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

function syncLocalStorageToServer() {
  // Upload localStorage states to server (fire-and-forget, best-effort)
  try {
    const movieRaw = localStorage.getItem("newsagg_movie_states");
    if (movieRaw) {
      const states = JSON.parse(movieRaw) as Record<
        string,
        { watched: boolean; inList: boolean; bookmarked: boolean }
      >;
      // Convert camelCase keys to snake_case for the API
      const converted: Record<number, { watched: boolean; in_list: boolean; bookmarked: boolean }> = {};
      for (const [k, v] of Object.entries(states)) {
        converted[Number(k)] = { watched: v.watched, in_list: v.inList, bookmarked: v.bookmarked };
      }
      if (Object.keys(converted).length > 0) {
        apiBulkSyncMovieStates(converted).catch(() => {});
      }
    }

    const bookRaw = localStorage.getItem("newsagg_book_states");
    if (bookRaw) {
      const states = JSON.parse(bookRaw) as Record<
        string,
        { read: boolean; inList: boolean; bookmarked: boolean }
      >;
      const converted: Record<number, { read: boolean; in_list: boolean; bookmarked: boolean }> = {};
      for (const [k, v] of Object.entries(states)) {
        converted[Number(k)] = { read: v.read, in_list: v.inList, bookmarked: v.bookmarked };
      }
      if (Object.keys(converted).length > 0) {
        apiBulkSyncBookStates(converted).catch(() => {});
      }
    }
  } catch {
    // Never block login over sync errors
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Restore session from stored token on mount
  useEffect(() => {
    const token = getToken();
    if (!token) { setIsLoading(false); return; }
    apiMe()
      .then((u) => { setUserScope(u.id); setUser(u); })
      .catch(() => { clearToken(); setUserScope(null); })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    setToken(res.access_token);
    setUserScope(res.user.id);
    setUser(res.user);
    setAuthModalOpen(false);
    syncLocalStorageToServer();
  }, []);

  const signup = useCallback(async (username: string, email: string, password: string) => {
    const res = await apiSignup(username, email, password);
    setToken(res.access_token);
    setUserScope(res.user.id);
    setUser(res.user);
    setAuthModalOpen(false);
    syncLocalStorageToServer();
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUserScope(null);
    setUser(null);
    // Notify all lib listeners so components re-read the (now guest) scoped keys
    window.dispatchEvent(new Event("bookmarks-changed"));
    window.dispatchEvent(new Event("movie-states-changed"));
    window.dispatchEvent(new Event("book-states-changed"));
    window.dispatchEvent(new Event("custom-movies-changed"));
    window.dispatchEvent(new Event("custom-books-changed"));
    window.dispatchEvent(new Event("race-states-changed"));
    window.dispatchEvent(new Event("match-states-changed"));
  }, []);

  const openAuthModal = useCallback(() => setAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, openAuthModal, closeAuthModal, authModalOpen }}>
      {children}
    </AuthContext.Provider>
  );
}
