"use client";

import { getUserScope } from "@/app/lib/userScope";

const BASE_KEY         = "newsagg_custom_movies";
const BASE_COUNTER_KEY = "newsagg_custom_movies_counter";
const key         = () => BASE_KEY         + getUserScope();
const counterKey  = () => BASE_COUNTER_KEY + getUserScope();

// Custom movies use rankings >= 10001 to avoid collision with built-in list
export interface CustomMovie {
  ranking: number;
  title: string;
  year: number;
  director: string;
  overallScore: number;
  criticsScore: number;
  domesticScore: number;
  internationalScore: number;
  description: string;
  genre: string;
}

function nextRanking(): number {
  if (typeof window === "undefined") return 10001;
  const current = parseInt(localStorage.getItem(counterKey()) ?? "10000", 10);
  const next = current + 1;
  localStorage.setItem(counterKey(), String(next));
  return next;
}

export function getCustomMovies(): CustomMovie[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key()) ?? "[]");
  } catch {
    return [];
  }
}

function saveCustomMovies(movies: CustomMovie[]) {
  localStorage.setItem(key(), JSON.stringify(movies));
  window.dispatchEvent(new Event("custom-movies-changed"));
}

export function addCustomMovie(data: {
  title: string;
  year: number;
  director: string;
  overallScore: number;
  description: string;
  genre: string;
}): CustomMovie {
  const movie: CustomMovie = {
    ranking: nextRanking(),
    title: data.title,
    year: data.year,
    director: data.director,
    overallScore: data.overallScore,
    criticsScore: 0,
    domesticScore: 0,
    internationalScore: 0,
    description: data.description,
    genre: data.genre,
  };
  const movies = getCustomMovies();
  movies.push(movie);
  saveCustomMovies(movies);
  return movie;
}

export function removeCustomMovie(ranking: number) {
  const movies = getCustomMovies().filter((m) => m.ranking !== ranking);
  saveCustomMovies(movies);
}
