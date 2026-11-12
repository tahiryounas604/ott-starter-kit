export interface ContentItem {
  id: number;
  title: string;
  description: string;
  type: "movie" | "episode" | "live";
  genre: string;
  year: number | null;
  duration_seconds: number | null;
  poster_url: string;
  hls_path: string | null;
}

export interface CatalogResponse {
  items: ContentItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}
