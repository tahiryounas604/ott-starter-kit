// Input validation for catalog payloads. Returns a list of human-readable
// problems; an empty list means the payload is valid.
export interface ContentInput {
  title: string;
  description: string;
  type: "movie" | "episode" | "live";
  genre: string;
  year: number | null;
  duration_seconds: number | null;
  poster_url: string;
  hls_path: string | null;
}

const TYPES = ["movie", "episode", "live"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateContentInput(body: unknown): { errors: string[]; value: ContentInput | null } {
  const errors: string[] = [];
  if (!isPlainObject(body)) return { errors: ["Request body must be a JSON object."], value: null };

  const title = body.title;
  if (typeof title !== "string" || title.trim().length === 0) errors.push("title is required.");
  else if (title.trim().length > 200) errors.push("title must be at most 200 characters.");

  const type = body.type ?? "movie";
  if (typeof type !== "string" || !(TYPES as readonly string[]).includes(type)) {
    errors.push("type must be one of: movie, episode, live.");
  }

  const description = body.description ?? "";
  if (typeof description !== "string" || description.length > 5000) {
    errors.push("description must be a string of at most 5000 characters.");
  }

  const genre = body.genre ?? "";
  if (typeof genre !== "string" || genre.length > 80) errors.push("genre must be a string of at most 80 characters.");

  let year: number | null = null;
  if (body.year !== undefined && body.year !== null) {
    if (typeof body.year !== "number" || !Number.isInteger(body.year) || body.year < 1900 || body.year > 2100) {
      errors.push("year must be an integer between 1900 and 2100.");
    } else year = body.year;
  }

  let duration: number | null = null;
  if (body.duration_seconds !== undefined && body.duration_seconds !== null) {
    if (typeof body.duration_seconds !== "number" || !Number.isInteger(body.duration_seconds) || body.duration_seconds < 0) {
      errors.push("duration_seconds must be a non-negative integer.");
    } else duration = body.duration_seconds;
  }

  const posterUrl = body.poster_url ?? "";
  if (typeof posterUrl !== "string" || posterUrl.length > 2000) {
    errors.push("poster_url must be a string of at most 2000 characters.");
  } else if (posterUrl !== "" && !/^https?:\/\/.+/i.test(posterUrl)) {
    errors.push("poster_url must be an http(s) URL or empty.");
  }

  let hlsPath: string | null = null;
  if (body.hls_path !== undefined && body.hls_path !== null) {
    if (typeof body.hls_path !== "string" || body.hls_path.length > 500) {
      errors.push("hls_path must be a string of at most 500 characters.");
    } else if (body.hls_path.startsWith("/") || body.hls_path.includes("..") || body.hls_path.includes("\\")) {
      errors.push("hls_path must be a relative path inside the content directory (no '..' or absolute paths).");
    } else if (body.hls_path !== "") hlsPath = body.hls_path;
  }

  if (errors.length > 0) return { errors, value: null };
  return {
    errors: [],
    value: {
      title: (title as string).trim(),
      description: description as string,
      type: type as ContentInput["type"],
      genre: genre as string,
      year,
      duration_seconds: duration,
      poster_url: posterUrl as string,
      hls_path: hlsPath,
    },
  };
}

export function validateAuthInput(body: unknown): { errors: string[]; email: string; password: string; name: string } {
  const errors: string[] = [];
  if (!isPlainObject(body)) return { errors: ["Request body must be a JSON object."], email: "", password: "", name: "" };
  const email = body.email;
  const password = body.password;
  const name = typeof body.name === "string" ? body.name : "";
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("email must be a valid email address.");
  if (typeof password !== "string" || password.length < 8) errors.push("password must be at least 8 characters.");
  if (name.length > 120) errors.push("name must be at most 120 characters.");
  return { errors, email: typeof email === "string" ? email.trim().toLowerCase() : "", password: typeof password === "string" ? password : "", name };
}

export function parsePagination(query: Record<string, unknown>): { limit: number; offset: number; errors: string[] } {
  const errors: string[] = [];
  let limit = 20;
  let offset = 0;
  if (query.limit !== undefined) {
    const n = Number(query.limit);
    if (!Number.isInteger(n) || n < 1 || n > 100) errors.push("limit must be an integer between 1 and 100.");
    else limit = n;
  }
  if (query.offset !== undefined) {
    const n = Number(query.offset);
    if (!Number.isInteger(n) || n < 0) errors.push("offset must be a non-negative integer.");
    else offset = n;
  }
  return { limit, offset, errors };
}
