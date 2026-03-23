"use client";

import { useState, useEffect } from "react";
import { getUserScope } from "@/app/lib/userScope";

const BASE_RACE_KEY  = "newsagg_race_states";
const BASE_MATCH_KEY = "newsagg_match_states";
const raceKey  = () => BASE_RACE_KEY  + getUserScope();
const matchKey = () => BASE_MATCH_KEY + getUserScope();

export interface SportItemState { watched: boolean; bookmarked: boolean }

function getStates(storageKey: string): Record<string, SportItemState> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(storageKey) ?? "{}"); }
  catch { return {}; }
}

function saveStates(storageKey: string, states: Record<string, SportItemState>, event: string) {
  localStorage.setItem(storageKey, JSON.stringify(states));
  window.dispatchEvent(new Event(event));
}

// ── Race (F1) ─────────────────────────────────────────────────────────────────

export function getRaceState(key: string): SportItemState {
  return getStates(raceKey())[key] ?? { watched: false, bookmarked: false };
}

export function toggleRaceField(key: string, field: keyof SportItemState): SportItemState {
  const states = getStates(raceKey());
  const current = states[key] ?? { watched: false, bookmarked: false };
  const updated = { ...current, [field]: !current[field] };
  if (!updated.watched && !updated.bookmarked) delete states[key];
  else states[key] = updated;
  saveStates(raceKey(), states, "race-states-changed");
  return updated;
}

export function useRaceState(key: string) {
  const [state, setState] = useState<SportItemState>({ watched: false, bookmarked: false });

  useEffect(() => {
    setState(getRaceState(key));
    const handler = () => setState(getRaceState(key));
    window.addEventListener("race-states-changed", handler);
    return () => window.removeEventListener("race-states-changed", handler);
  }, [key]);

  function toggle(field: keyof SportItemState, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setState(toggleRaceField(key, field));
  }

  return { state, toggle };
}

// ── Match (Football) ──────────────────────────────────────────────────────────

export function getMatchState(key: string): SportItemState {
  return getStates(matchKey())[key] ?? { watched: false, bookmarked: false };
}

export function toggleMatchField(key: string, field: keyof SportItemState): SportItemState {
  const states = getStates(matchKey());
  const current = states[key] ?? { watched: false, bookmarked: false };
  const updated = { ...current, [field]: !current[field] };
  if (!updated.watched && !updated.bookmarked) delete states[key];
  else states[key] = updated;
  saveStates(matchKey(), states, "match-states-changed");
  return updated;
}

export function useMatchState(key: string) {
  const [state, setState] = useState<SportItemState>({ watched: false, bookmarked: false });

  useEffect(() => {
    setState(getMatchState(key));
    const handler = () => setState(getMatchState(key));
    window.addEventListener("match-states-changed", handler);
    return () => window.removeEventListener("match-states-changed", handler);
  }, [key]);

  function toggle(field: keyof SportItemState, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setState(toggleMatchField(key, field));
  }

  return { state, toggle };
}
