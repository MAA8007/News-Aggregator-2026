import type { Filters, PaginatedArticles, Sections } from "@/app/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function fetchNews(params: {
  page?: number;
  pageSize?: number;
  category?: string | null;
  source?: string | null;
}): Promise<PaginatedArticles> {
  const { page = 1, pageSize = 12, category, source } = params;
  const url = new URL(`${API_BASE}/api/news`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(pageSize));
  if (category) url.searchParams.set("category", category);
  if (source) url.searchParams.set("source", source);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchNews failed: ${res.status}`);
  return res.json();
}

export async function fetchSections(
  categories: string[],
  perCategory = 5,
): Promise<Sections> {
  const url = new URL(`${API_BASE}/api/news/sections`);
  url.searchParams.set("categories", categories.join(","));
  url.searchParams.set("per_category", String(perCategory));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchSections failed: ${res.status}`);
  return res.json();
}

export async function fetchFilters(): Promise<Filters> {
  const res = await fetch(`${API_BASE}/api/news/filters`, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchFilters failed: ${res.status}`);
  return res.json();
}

export interface ScrapeResult {
  status: string;
  message: string;
  saved: number;
  skipped: number;
  errors: number;
}

export async function scrapeCustomFeed(
  url: string,
  source: string,
  category: string,
): Promise<ScrapeResult> {
  const res = await fetch(`${API_BASE}/api/feeds/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, source, category }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`scrapeCustomFeed failed: ${res.status}`);
  return res.json();
}

export async function triggerScrape(): Promise<ScrapeResult> {
  const res = await fetch(`${API_BASE}/api/scrape`, { method: "POST", cache: "no-store" });
  if (!res.ok) throw new Error(`triggerScrape failed: ${res.status}`);
  return res.json();
}

export async function searchNews(
  q: string,
  page = 1,
  pageSize = 20,
): Promise<PaginatedArticles> {
  const url = new URL(`${API_BASE}/api/news/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(pageSize));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`searchNews failed: ${res.status}`);
  return res.json();
}
