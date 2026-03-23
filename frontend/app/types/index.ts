export interface Article {
  id: number;
  title: string;
  link: string;
  pub_date: string | null;
  image_url: string | null;
  source: string;
  category: string;
  created_at: string;
  snippet: string;
  read_minutes: number;
}

export interface PaginatedArticles {
  total: number;
  page: number;
  page_size: number;
  items: Article[];
}

export type Sections = Record<string, Article[]>;

export interface Filters {
  categories: string[];
  sources: string[];
  source_categories: Record<string, string[]>;
  category_counts: Record<string, number>;
  source_counts: Record<string, number>;
}
