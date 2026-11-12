// SQLite storage for ott-starter-kit.
// Uses Node 24's built-in node:sqlite (DatabaseSync) — no extra dependency.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export interface UserRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: "admin" | "viewer";
  created_at: string;
}

export interface ContentRow {
  id: number;
  title: string;
  description: string;
  type: "movie" | "episode" | "live";
  genre: string;
  year: number | null;
  duration_seconds: number | null;
  poster_url: string;
  hls_path: string | null;
  created_at: string;
  updated_at: string;
}

export const SEED_CONTENT: Omit<ContentRow, "id" | "created_at" | "updated_at">[] = [
  {
    title: "Tytechlabs Sample Reel",
    description:
      "Bundled 12-second sample asset generated with ffmpeg. The only title with a playable HLS stream in v0.1 — use it to verify playback end to end.",
    type: "movie",
    genre: "Demo",
    year: 2026,
    duration_seconds: 12,
    poster_url: "",
    hls_path: "sample/master.m3u8",
  },
  {
    title: "Mountain Light",
    description: "A quiet drama about a lighthouse keeper's last winter on the coast.",
    type: "movie",
    genre: "Drama",
    year: 2024,
    duration_seconds: 6240,
    poster_url: "",
    hls_path: null,
  },
  {
    title: "Orbit Nine — Episode 1",
    description: "The crew of the Orbit Nine wakes to a signal that should not exist.",
    type: "episode",
    genre: "Sci-Fi",
    year: 2025,
    duration_seconds: 2700,
    poster_url: "",
    hls_path: null,
  },
  {
    title: "Orbit Nine — Episode 2",
    description: "A supply run goes wrong when the station's airlock refuses to seal.",
    type: "episode",
    genre: "Sci-Fi",
    year: 2025,
    duration_seconds: 2640,
    poster_url: "",
    hls_path: null,
  },
  {
    title: "City Kitchen",
    description: "Street-food cooks compete across five neighbourhoods.",
    type: "movie",
    genre: "Documentary",
    year: 2023,
    duration_seconds: 5400,
    poster_url: "",
    hls_path: null,
  },
  {
    title: "Tytechlabs Live Channel",
    description: "Placeholder live channel. No live source is bundled in v0.1.",
    type: "live",
    genre: "Live",
    year: 2026,
    duration_seconds: null,
    poster_url: "",
    hls_path: null,
  },
];

export function openDb(dbPath: string): DatabaseSync {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','viewer')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'movie' CHECK (type IN ('movie','episode','live')),
      genre TEXT NOT NULL DEFAULT '',
      year INTEGER,
      duration_seconds INTEGER,
      poster_url TEXT NOT NULL DEFAULT '',
      hls_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_content_title ON content(title);
    CREATE INDEX IF NOT EXISTS idx_content_genre ON content(genre);
  `);
  const count = db.prepare("SELECT COUNT(*) AS n FROM content").get() as { n: number };
  if (count.n === 0) {
    const insert = db.prepare(
      "INSERT INTO content (title, description, type, genre, year, duration_seconds, poster_url, hls_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const item of SEED_CONTENT) {
      insert.run(
        item.title,
        item.description,
        item.type,
        item.genre,
        item.year,
        item.duration_seconds,
        item.poster_url,
        item.hls_path,
      );
    }
  }
  return db;
}
