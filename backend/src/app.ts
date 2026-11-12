// Express app factory for ott-starter-kit.
// createApp() is exported so tests can spin up the real server on an
// ephemeral port against a throwaway database — no mocks anywhere.
import express, { type Express, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { openDb, type ContentRow, type UserRow } from "./db";
import { getSecret, hashPassword, requireAdmin, requireAuth, signToken, verifyPassword, type AuthedRequest } from "./auth";
import { parsePagination, validateAuthInput, validateContentInput } from "./validate";

export interface AppOptions {
  dbPath: string;
  contentDir: string;
  jwtSecret?: string;
}

const MIME: Record<string, string> = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
};

function publicUser(row: UserRow): { id: number; email: string; name: string; role: string } {
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export function createApp(options: AppOptions): Express {
  const db = openDb(options.dbPath);
  const secret = options.jwtSecret ?? getSecret();
  const contentDir = path.resolve(options.contentDir);
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "ott-starter-kit", version: "0.1.0" });
  });

  app.get("/", (_req: Request, res: Response) => {
    res.json({
      service: "ott-starter-kit",
      version: "0.1.0",
      endpoints: [
        "GET /health",
        "POST /api/auth/register",
        "POST /api/auth/login",
        "GET /api/auth/me",
        "GET /api/catalog?q=&genre=&type=&limit=&offset=",
        "GET /api/catalog/:id",
        "POST /api/catalog (admin)",
        "PUT /api/catalog/:id (admin)",
        "DELETE /api/catalog/:id (admin)",
        "GET /api/search?q=",
        "GET /api/play/:id/master.m3u8",
        "GET /api/play/:id/:segment",
      ],
    });
  });

  // ---- Auth ----
  app.post("/api/auth/register", (req: Request, res: Response) => {
    const { errors, email, password, name } = validateAuthInput(req.body);
    if (errors.length > 0) {
      res.status(400).json({ error: "validation_error", errors });
      return;
    }
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      res.status(409).json({ error: "conflict", message: "An account with this email already exists." });
      return;
    }
    const userCount = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
    const role = userCount.n === 0 ? "admin" : "viewer";
    const result = db
      .prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)")
      .run(email, name, hashPassword(password), role);
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid) as unknown as UserRow;
    const token = signToken({ sub: row.id, email: row.email, role: row.role }, secret);
    res.status(201).json({ user: publicUser(row), token });
  });

  app.post("/api/auth/login", (req: Request, res: Response) => {
    const { errors, email, password } = validateAuthInput(req.body);
    if (errors.length > 0) {
      res.status(400).json({ error: "validation_error", errors });
      return;
    }
    const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as unknown as UserRow | undefined;
    if (!row || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: "invalid_credentials", message: "Email or password is incorrect." });
      return;
    }
    const token = signToken({ sub: row.id, email: row.email, role: row.role }, secret);
    res.json({ user: publicUser(row), token });
  });

  app.get("/api/auth/me", requireAuth(secret), (req: AuthedRequest, res: Response) => {
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.sub) as unknown as UserRow | undefined;
    if (!row) {
      res.status(404).json({ error: "not_found", message: "User not found." });
      return;
    }
    res.json({ user: publicUser(row) });
  });

  // ---- Catalog (public read, admin write) ----
  function listCatalog(req: Request, res: Response): void {
    const { limit, offset, errors } = parsePagination(req.query as Record<string, unknown>);
    if (errors.length > 0) {
      res.status(400).json({ error: "validation_error", errors });
      return;
    }
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const genre = typeof req.query.genre === "string" ? req.query.genre.trim() : "";
    const type = typeof req.query.type === "string" ? req.query.type.trim() : "";
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (q) {
      where.push("(title LIKE ? OR description LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }
    if (genre) {
      where.push("genre = ?");
      params.push(genre);
    }
    if (type) {
      if (!["movie", "episode", "live"].includes(type)) {
        res.status(400).json({ error: "validation_error", errors: ["type must be one of: movie, episode, live."] });
        return;
      }
      where.push("type = ?");
      params.push(type);
    }
    const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const total = db.prepare(`SELECT COUNT(*) AS n FROM content ${clause}`).get(...params) as { n: number };
    const items = db
      .prepare(`SELECT * FROM content ${clause} ORDER BY id ASC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as unknown as ContentRow[];
    res.json({ items, total: total.n, limit, offset });
  }

  app.get("/api/catalog", listCatalog);
  app.get("/api/search", (req: Request, res: Response) => {
    if (typeof req.query.q !== "string" || req.query.q.trim() === "") {
      res.status(400).json({ error: "validation_error", errors: ["q query parameter is required."] });
      return;
    }
    listCatalog(req, res);
  });

  app.get("/api/catalog/:id", (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: "validation_error", errors: ["id must be a positive integer."] });
      return;
    }
    const row = db.prepare("SELECT * FROM content WHERE id = ?").get(id) as unknown as ContentRow | undefined;
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Content not found." });
      return;
    }
    res.json(row);
  });

  const admin = [requireAuth(secret), requireAdmin];

  app.post("/api/catalog", ...admin, (req: AuthedRequest, res: Response) => {
    const { errors, value } = validateContentInput(req.body);
    if (errors.length > 0 || !value) {
      res.status(400).json({ error: "validation_error", errors });
      return;
    }
    const result = db
      .prepare(
        "INSERT INTO content (title, description, type, genre, year, duration_seconds, poster_url, hls_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(value.title, value.description, value.type, value.genre, value.year, value.duration_seconds, value.poster_url, value.hls_path);
    const row = db.prepare("SELECT * FROM content WHERE id = ?").get(result.lastInsertRowid) as unknown as ContentRow;
    res.status(201).json(row);
  });

  app.put("/api/catalog/:id", ...admin, (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: "validation_error", errors: ["id must be a positive integer."] });
      return;
    }
    const existing = db.prepare("SELECT * FROM content WHERE id = ?").get(id) as unknown as ContentRow | undefined;
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Content not found." });
      return;
    }
    const { errors, value } = validateContentInput(req.body);
    if (errors.length > 0 || !value) {
      res.status(400).json({ error: "validation_error", errors });
      return;
    }
    db.prepare(
      "UPDATE content SET title = ?, description = ?, type = ?, genre = ?, year = ?, duration_seconds = ?, poster_url = ?, hls_path = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(value.title, value.description, value.type, value.genre, value.year, value.duration_seconds, value.poster_url, value.hls_path, id);
    const row = db.prepare("SELECT * FROM content WHERE id = ?").get(id) as unknown as ContentRow;
    res.json(row);
  });

  app.delete("/api/catalog/:id", ...admin, (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: "validation_error", errors: ["id must be a positive integer."] });
      return;
    }
    const result = db.prepare("DELETE FROM content WHERE id = ?").run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: "not_found", message: "Content not found." });
      return;
    }
    res.status(204).send();
  });

  // ---- HLS playback: serves real files from the content directory ----
  function servePlayFile(req: Request, res: Response): void {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: "validation_error", errors: ["id must be a positive integer."] });
      return;
    }
    const row = db.prepare("SELECT * FROM content WHERE id = ?").get(id) as unknown as ContentRow | undefined;
    if (!row || !row.hls_path) {
      res.status(404).json({ error: "not_found", message: "No playable stream for this title." });
      return;
    }
    const requested = typeof req.params.file === "string" ? req.params.file : "master.m3u8";
    const ext = path.extname(requested).toLowerCase();
    if (![".m3u8", ".ts"].includes(ext) || requested.includes("/") || requested.includes("\\") || requested.includes("..")) {
      res.status(400).json({ error: "validation_error", errors: ["Only .m3u8 playlists and .ts segments can be served."] });
      return;
    }
    // Segments live next to the playlist file, never outside the content dir.
    const playlistDir = path.dirname(path.join(contentDir, row.hls_path));
    const filePath = path.resolve(playlistDir, requested);
    if (!filePath.startsWith(contentDir + path.sep) && filePath !== contentDir) {
      res.status(400).json({ error: "validation_error", errors: ["Invalid file path."] });
      return;
    }
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "not_found", message: "Stream file not found on disk." });
      return;
    }
    res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache");
    fs.createReadStream(filePath).pipe(res);
  }

  app.get("/api/play/:id/master.m3u8", (req: Request, res: Response) => {
    req.params.file = "master.m3u8";
    servePlayFile(req, res);
  });
  app.get("/api/play/:id/:file", servePlayFile);

  // JSON 404 + error handler (never leak a stack trace to clients).
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "not_found", message: "Route not found." });
  });
  app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: "validation_error", errors: ["Request body must be valid JSON."] });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "internal_error", message: "Something went wrong." });
  });

  return app;
}
