// Auth: scrypt password hashing + HS256 JWT, both from node:crypto.
// No extra dependencies, so there is nothing else to audit or keep updated.
import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export interface JwtPayload {
  sub: number;
  email: string;
  role: "admin" | "viewer";
  exp: number;
}

export interface AuthedRequest extends Request {
  user?: JwtPayload;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signToken(payload: Omit<JwtPayload, "exp">, secret: string, ttlSeconds = 86400): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest();
  return `${header}.${body}.${base64url(sig)}`;
}

export function verifyToken(token: string, secret: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as JwtPayload;
    if (typeof payload.sub !== "number" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.role !== "admin" && payload.role !== "viewer") return null;
    return payload;
  } catch {
    return null;
  }
}

export function getSecret(): string {
  const secret = process.env.OTT_JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("OTT_JWT_SECRET must be set (at least 16 characters) in production.");
  }
  return "dev-only-secret-change-me-in-production";
}

export function requireAuth(secret: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "missing_token", message: "Authorization: Bearer <token> is required." });
      return;
    }
    const payload = verifyToken(token, secret);
    if (!payload) {
      res.status(401).json({ error: "invalid_token", message: "Token is invalid or expired." });
      return;
    }
    req.user = payload;
    next();
  };
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "forbidden", message: "Admin role is required." });
    return;
  }
  next();
}
