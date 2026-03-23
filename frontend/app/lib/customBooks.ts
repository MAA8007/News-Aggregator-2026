"use client";

import { getUserScope } from "@/app/lib/userScope";

const BASE_KEY         = "newsagg_custom_books";
const BASE_COUNTER_KEY = "newsagg_custom_books_counter";
const key         = () => BASE_KEY         + getUserScope();
const counterKey  = () => BASE_COUNTER_KEY + getUserScope();

// Custom books use rankings >= 20001 to avoid collision with built-in list
export interface CustomBook {
  ranking: number;
  title: string;
  author: string;
  year: number;
  yearDisplay: string;
  readTime: string;
  description: string;
}

function nextRanking(): number {
  if (typeof window === "undefined") return 20001;
  const current = parseInt(localStorage.getItem(counterKey()) ?? "20000", 10);
  const next = current + 1;
  localStorage.setItem(counterKey(), String(next));
  return next;
}

export function getCustomBooks(): CustomBook[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key()) ?? "[]");
  } catch {
    return [];
  }
}

function saveCustomBooks(books: CustomBook[]) {
  localStorage.setItem(key(), JSON.stringify(books));
  window.dispatchEvent(new Event("custom-books-changed"));
}

export function addCustomBook(data: {
  title: string;
  author: string;
  year: number;
  readTime: string;
  description: string;
}): CustomBook {
  const yearDisplay = data.year < 0 ? `${Math.abs(data.year)} BC` : String(data.year);
  const book: CustomBook = {
    ranking: nextRanking(),
    title: data.title,
    author: data.author,
    year: data.year,
    yearDisplay,
    readTime: data.readTime,
    description: data.description,
  };
  const books = getCustomBooks();
  books.push(book);
  saveCustomBooks(books);
  return book;
}

export function removeCustomBook(ranking: number) {
  const books = getCustomBooks().filter((b) => b.ranking !== ranking);
  saveCustomBooks(books);
}
