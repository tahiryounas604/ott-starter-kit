// API tests for ott-starter-kit. They run the REAL Express app on an
// ephemeral port against a throwaway SQLite database — no mocks.
// Run: npm test
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../src/app";
import { signToken, verifyToken } from "../src/auth";
import { validateContentInput } from "../src/validate";

let base = "";
let server: Server;
let tmpDir = "";

const json = async (res: Response) => {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { _raw: text };
  }
};

async function req(p: string, init?: RequestInit): Promise<{ status: number; body: Record<string, unknown>; text: string; headers: Headers }> {
  const res = await fetch(`${base}${p}`, init);
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = { _raw: text };
  }
  return { status: res.status, body, text, headers: res.headers };
}

const withAuth = (token: string, extra: RequestInit = {}): RequestInit => ({
  ...extra,
  headers: { ...(extra.headers as Record<string, string>), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
});

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ott-test-"));
  const app = createApp({
    dbPath: path.join(tmpDir, "ott.db"),
    contentDir: path.resolve("content"),
    jwtSecret: "test-secret-at-least-16-chars",
  });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

let adminToken = "";
let viewerToken = "";

describe("health and index", () => {
  it("GET /health returns ok", async () => {
    const r = await req("/health");
    assert.equal(r.status, 200);
    assert.equal(r.body.status, "ok");
  });

  it("GET / lists the API surface", async () => {
    const r = await req("/");
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.endpoints));
  });

  it("unknown route returns JSON 404", async () => {
    const r = await req("/nope");
    assert.equal(r.status, 404);
    assert.equal(r.body.error, "not_found");
  });
});

describe("auth", () => {
  it("first registered user becomes admin", async () => {
    const r = await req("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "password123", name: "Admin" }),
    });
    assert.equal(r.status, 201);
    assert.equal((r.body.user as Record<string, unknown>).role, "admin");
    assert.equal(typeof r.body.token, "string");
    adminToken = r.body.token as string;
  });

  it("second registered user is a viewer", async () => {
    const r = await req("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "viewer@example.com", password: "password123" }),
    });
    assert.equal(r.status, 201);
    assert.equal((r.body.user as Record<string, unknown>).role, "viewer");
    viewerToken = r.body.token as string;
  });

  it("duplicate email is rejected with 409", async () => {
    const r = await req("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "password123" }),
    });
    assert.equal(r.status, 409);
  });

  it("invalid email and short password are rejected with 400", async () => {
    const badEmail = await req("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "password123" }),
    });
    assert.equal(badEmail.status, 400);
    const shortPw = await req("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "x@example.com", password: "short" }),
    });
    assert.equal(shortPw.status, 400);
  });

  it("login succeeds with correct credentials", async () => {
    const r = await req("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "viewer@example.com", password: "password123" }),
    });
    assert.equal(r.status, 200);
    assert.equal(typeof r.body.token, "string");
  });

  it("login fails with wrong password", async () => {
    const r = await req("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "viewer@example.com", password: "wrongpassword" }),
    });
    assert.equal(r.status, 401);
  });

  it("GET /api/auth/me requires a token", async () => {
    const r = await req("/api/auth/me");
    assert.equal(r.status, 401);
  });

  it("GET /api/auth/me rejects a tampered token", async () => {
    const r = await req("/api/auth/me", { headers: { Authorization: `Bearer ${adminToken.slice(0, -2)}xx` } });
    assert.equal(r.status, 401);
  });

  it("GET /api/auth/me returns the current admin", async () => {
    const r = await req("/api/auth/me", { headers: { Authorization: `Bearer ${adminToken}` } });
    assert.equal(r.status, 200);
    assert.equal((r.body.user as Record<string, unknown>).email, "admin@example.com");
  });
});

describe("catalog read", () => {
  it("lists the 6 seeded titles", async () => {
    const r = await req("/api/catalog");
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 6);
    assert.equal((r.body.items as unknown[]).length, 6);
  });

  it("search finds Orbit titles", async () => {
    const r = await req("/api/search?q=Orbit");
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 2);
  });

  it("search without q is a 400", async () => {
    const r = await req("/api/search");
    assert.equal(r.status, 400);
  });

  it("catalog search via q parameter works", async () => {
    const r = await req("/api/catalog?q=Kitchen");
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 1);
  });

  it("genre and type filters work", async () => {
    const byGenre = await req("/api/catalog?genre=Sci-Fi");
    assert.equal(byGenre.body.total, 2);
    const byType = await req("/api/catalog?type=live");
    assert.equal(byType.body.total, 1);
    const badType = await req("/api/catalog?type=bogus");
    assert.equal(badType.status, 400);
  });

  it("pagination limit and offset work", async () => {
    const page1 = await req("/api/catalog?limit=2&offset=0");
    assert.equal((page1.body.items as unknown[]).length, 2);
    assert.equal(page1.body.total, 6);
    const page2 = await req("/api/catalog?limit=2&offset=2");
    assert.equal((page2.body.items as unknown[]).length, 2);
    assert.notEqual(
      (page1.body.items as Record<string, unknown>[])[0].id,
      (page2.body.items as Record<string, unknown>[])[0].id,
    );
    const badLimit = await req("/api/catalog?limit=0");
    assert.equal(badLimit.status, 400);
    const hugeLimit = await req("/api/catalog?limit=101");
    assert.equal(hugeLimit.status, 400);
  });

  it("get by id returns the sample reel with its HLS path", async () => {
    const r = await req("/api/catalog/1");
    assert.equal(r.status, 200);
    assert.equal(r.body.title, "Tytechlabs Sample Reel");
    assert.equal(r.body.hls_path, "sample/master.m3u8");
  });

  it("get by missing id is 404, bad id is 400", async () => {
    assert.equal((await req("/api/catalog/9999")).status, 404);
    assert.equal((await req("/api/catalog/abc")).status, 400);
  });
});

describe("catalog write (admin only)", () => {
  let createdId = 0;

  it("POST without a token is 401", async () => {
    const r = await req("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Nope" }),
    });
    assert.equal(r.status, 401);
  });

  it("POST as viewer is 403", async () => {
    const r = await req(
      "/api/catalog",
      withAuth(viewerToken, { method: "POST", body: JSON.stringify({ title: "Nope" }) }),
    );
    assert.equal(r.status, 403);
  });

  it("POST as admin creates a title", async () => {
    const r = await req(
      "/api/catalog",
      withAuth(adminToken, {
        method: "POST",
        body: JSON.stringify({ title: "Test Movie", description: "Created by tests.", type: "movie", genre: "Drama", year: 2026, duration_seconds: 3600 }),
      }),
    );
    assert.equal(r.status, 201);
    assert.equal(r.body.title, "Test Movie");
    createdId = r.body.id as number;
    assert.ok(createdId > 6);
  });

  it("POST validation rejects missing title, bad type, bad year, traversal hls_path", async () => {
    const cases: Record<string, unknown>[] = [
      { type: "movie" },
      { title: "X", type: "bogus" },
      { title: "X", year: 1800 },
      { title: "X", hls_path: "../secret/master.m3u8" },
      { title: "X", poster_url: "ftp://example.com/poster.jpg" },
    ];
    for (const payload of cases) {
      const r = await req("/api/catalog", withAuth(adminToken, { method: "POST", body: JSON.stringify(payload) }));
      assert.equal(r.status, 400, `expected 400 for ${JSON.stringify(payload)}, got ${r.status}`);
    }
  });

  it("PUT as admin updates the title", async () => {
    const r = await req(
      `/api/catalog/${createdId}`,
      withAuth(adminToken, {
        method: "PUT",
        body: JSON.stringify({ title: "Test Movie (Edited)", type: "movie", genre: "Drama", year: 2026 }),
      }),
    );
    assert.equal(r.status, 200);
    assert.equal(r.body.title, "Test Movie (Edited)");
  });

  it("PUT on a missing id is 404; DELETE as viewer is 403", async () => {
    const put = await req(
      "/api/catalog/9999",
      withAuth(adminToken, { method: "PUT", body: JSON.stringify({ title: "X" }) }),
    );
    assert.equal(put.status, 404);
    const del = await req(`/api/catalog/${createdId}`, withAuth(viewerToken, { method: "DELETE" }));
    assert.equal(del.status, 403);
  });

  it("DELETE as admin removes the title", async () => {
    const r = await req(`/api/catalog/${createdId}`, withAuth(adminToken, { method: "DELETE" }));
    assert.equal(r.status, 204);
    assert.equal((await req(`/api/catalog/${createdId}`)).status, 404);
  });
});

describe("HLS playback", () => {
  it("serves the sample master playlist as HLS", async () => {
    const r = await req("/api/play/1/master.m3u8");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type") ?? "", /mpegurl/);
    assert.match(r.text, /#EXTM3U/);
    assert.match(r.text, /segment000\.ts/);
    assert.match(r.text, /#EXT-X-ENDLIST/);
  });

  it("serves a real .ts segment with bytes", async () => {
    const r = await req("/api/play/1/segment000.ts");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type") ?? "", /mp2t/);
    assert.ok(r.text.length > 10000, "segment should carry real video bytes");
  });

  it("title without a stream is 404; missing title is 404", async () => {
    assert.equal((await req("/api/play/2/master.m3u8")).status, 404);
    assert.equal((await req("/api/play/9999/master.m3u8")).status, 404);
  });

  it("non-media extensions and traversal are rejected", async () => {
    assert.equal((await req("/api/play/1/notes.json")).status, 400);
    assert.equal((await req("/api/play/1/%2E%2E%2Fsecret.ts")).status, 400);
  });
});

describe("validation and token units", () => {
  it("validateContentInput accepts a good payload and rejects a bad one", () => {
    const good = validateContentInput({ title: "Ok", type: "episode", year: 2020 });
    assert.equal(good.errors.length, 0);
    assert.equal(good.value?.title, "Ok");
    const bad = validateContentInput({ title: "", type: "nope", year: 3000 });
    assert.ok(bad.errors.length >= 3);
    assert.equal(bad.value, null);
  });

  it("JWT round-trip verifies; tampered and expired tokens fail", () => {
    const secret = "unit-test-secret-16+";
    const token = signToken({ sub: 7, email: "a@b.c", role: "viewer" }, secret);
    const payload = verifyToken(token, secret);
    assert.equal(payload?.sub, 7);
    assert.equal(verifyToken(token + "x", secret), null);
    assert.equal(verifyToken(token, "wrong-secret-16-chars"), null);
    const expired = signToken({ sub: 7, email: "a@b.c", role: "viewer" }, secret, -10);
    assert.equal(verifyToken(expired, secret), null);
  });
});
