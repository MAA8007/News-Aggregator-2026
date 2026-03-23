"use client";

import { useState, useEffect } from "react";

import { getUserScope } from "@/app/lib/userScope";

const BASE_KEY = "newsagg_movie_states";
const key = () => BASE_KEY + getUserScope();

export interface MovieState {
  watched: boolean;
  inList: boolean;
  bookmarked: boolean;
}

type States = Record<number, MovieState>;

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
  window.dispatchEvent(new Event("movie-states-changed"));
}

export function getMovieState(ranking: number): MovieState {
  return getStates()[ranking] ?? { watched: false, inList: false, bookmarked: false };
}

export function toggleMovieField(ranking: number, field: keyof MovieState): MovieState {
  const states = getStates();
  const current = states[ranking] ?? { watched: false, inList: false, bookmarked: false };
  const updated = { ...current, [field]: !current[field] };
  if (!updated.watched && !updated.inList && !updated.bookmarked) {
    delete states[ranking];
  } else {
    states[ranking] = updated;
  }
  saveStates(states);
  return updated;
}

export function getMovieListCount(): number {
  const states = getStates();
  return Object.values(states).filter((s) => s.inList).length;
}

export function useMovieState(ranking: number) {
  const [state, setState] = useState<MovieState>({ watched: false, inList: false, bookmarked: false });

  useEffect(() => {
    setState(getMovieState(ranking));
    const handler = () => setState(getMovieState(ranking));
    window.addEventListener("movie-states-changed", handler);
    return () => window.removeEventListener("movie-states-changed", handler);
  }, [ranking]);

  function toggle(field: keyof MovieState, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setState(toggleMovieField(ranking, field));
  }

  return { state, toggle };
}

export function useMovieListCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(getMovieListCount());
    const handler = () => setCount(getMovieListCount());
    window.addEventListener("movie-states-changed", handler);
    return () => window.removeEventListener("movie-states-changed", handler);
  }, []);

  return count;
}
