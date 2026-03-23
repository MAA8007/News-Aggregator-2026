"use client";

import { useState, useEffect } from "react";

import { getUserScope } from "@/app/lib/userScope";

const BASE_KEY = "newsagg_book_states";
const key = () => BASE_KEY + getUserScope();

export interface BookState {
  read: boolean;
  inList: boolean;
  bookmarked: boolean;
}

type States = Record<number, BookState>;

export function getStates(): States {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(key()) ?? "{}");
  } catch {
    return {};
  }
}

function saveStates(states: States) {
  localStorage.setItem(key(), JSON.stringify(states));
  window.dispatchEvent(new Event("book-states-changed"));
}

export function getBookState(ranking: number): BookState {
  return getStates()[ranking] ?? { read: false, inList: false, bookmarked: false };
}

export function toggleBookField(ranking: number, field: keyof BookState): BookState {
  const states = getStates();
  const current = states[ranking] ?? { read: false, inList: false, bookmarked: false };
  const updated = { ...current, [field]: !current[field] };
  if (!updated.read && !updated.inList && !updated.bookmarked) {
    delete states[ranking];
  } else {
    states[ranking] = updated;
  }
  saveStates(states);
  return updated;
}

export function getBookListCount(): number {
  const states = getStates();
  return Object.values(states).filter((s) => s.inList).length;
}

export function useBookState(ranking: number) {
  const [state, setState] = useState<BookState>({ read: false, inList: false, bookmarked: false });

  useEffect(() => {
    setState(getBookState(ranking));
    const handler = () => setState(getBookState(ranking));
    window.addEventListener("book-states-changed", handler);
    return () => window.removeEventListener("book-states-changed", handler);
  }, [ranking]);

  function toggle(field: keyof BookState, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setState(toggleBookField(ranking, field));
  }

  return { state, toggle };
}

export function useBookListCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(getBookListCount());
    const handler = () => setCount(getBookListCount());
    window.addEventListener("book-states-changed", handler);
    return () => window.removeEventListener("book-states-changed", handler);
  }, []);

  return count;
}
