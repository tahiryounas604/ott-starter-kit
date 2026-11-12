# ott-starter-kit

A white-label OTT (streaming) starter kit: run your own small streaming
service. A TypeScript/Node.js backend serves a content catalog and HLS
video; Roku, Android TV / Fire TV, and Apple TV clients play it; a React
admin dashboard manages the catalog.

Clean-room code, written for this project. No code copied from other
projects. License: GPL-3.0.

## What is in v0.1

| Part | Status |
| --- | --- |
| Backend (TypeScript/Node, Express + SQLite) | Working, tested (33 tests, all passing) |
| Sample HLS asset (12 s, generated with ffmpeg) | Working, verified end to end |
| Roku channel (BrightScript / SceneGraph) | Code-complete, **not compiled or run here** |
| Android TV / Fire TV app (Kotlin / Leanback + ExoPlayer) | Code-complete, **not compiled or run here** |
| Apple TV app (Swift / SwiftUI + AVPlayer) | Code-complete, **not compiled or run here** |
| React admin dashboard | Code-complete, **production build verified** |

## Backend features

- **Content catalog** (SQLite, `node:sqlite` — no extra database dependency):
  list, get by id, search, genre/type filters, pagination.
- **JWT auth** (HS256 via `node:crypto`, scrypt password hashing):
  register, login, `/api/auth/me`. The **first registered user is the
  admin**; later users are viewers. Only admins can create, edit, or
  delete catalog titles.
- **HLS playback**: `GET /api/play/:id/master.m3u8` and
  `GET /api/play/:id/:segment` serve real playlist/segment files from the
  local `content/` directory. Path traversal is rejected.
- **Schema validation** on every write endpoint (title, type, year,
  duration, poster URL, `hls_path`) with 400 responses that list the problems.
- **Seed data**: 6 titles on first run. Only *Tytechlabs Sample Reel*
  (id 1) ships with a playable HLS stream; the others are catalog entries
  awaiting real media.

## Quick start

```bash
npm install
npm start          # backend on http://localhost:3000
```

Then, in another terminal:

```bash
# health + catalog
curl http://localhost:3000/health
curl http://localhost:3000/api/catalog

# register the first user (becomes admin) and keep the token
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"change-me-123"}'
# (register first: POST /api/auth/register with the same body)

# play the sample stream (any HLS player, e.g. VLC: open the URL)
curl http://localhost:3000/api/play/1/master.m3u8
```

### Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3000` | |
| `OTT_DB_PATH` | `./data/ott.db` | SQLite file, created on first start |
| `OTT_CONTENT_DIR` | `./content` | HLS files live here |
| `OTT_JWT_SECRET` | dev-only fallback | **Set a secret of 16+ characters in production** (required: the server refuses to start in production without one) |
| `OTT_ADMIN_EMAIL` / `OTT_ADMIN_PASSWORD` | — | If both are set, an admin user is seeded when no users exist |

### Admin dashboard

```bash
cd admin
npm install
npm run dev    # http://localhost:5173, proxies /api to the backend
```

Sign in with an admin account, then list, search, add, edit, and delete
titles. Viewers can browse but cannot change anything.

### Tests

```bash
npm test       # builds, then runs node:test against the real server
```

33 tests covering auth (register/login/roles/tampered + expired tokens),
catalog read (search, filters, pagination), catalog write (401/403/400/404
paths), HLS playback (playlist, real segment bytes, traversal rejection),
and validation/token units. They run against a throwaway database on an
ephemeral port — no mocks.

## API reference

| Method & path | Auth | Description |
| --- | --- | --- |
| `GET /health` | — | Service status |
| `POST /api/auth/register` | — | `{email, password, name?}` → `{user, token}` (201; 409 on duplicate) |
| `POST /api/auth/login` | — | `{email, password}` → `{user, token}` (401 on bad credentials) |
| `GET /api/auth/me` | Bearer | Current user |
| `GET /api/catalog?q=&genre=&type=&limit=&offset=` | — | `{items, total, limit, offset}` |
| `GET /api/catalog/:id` | — | One title (404 if missing) |
| `POST /api/catalog` | Admin | Create a title (201) |
| `PUT /api/catalog/:id` | Admin | Replace a title |
| `DELETE /api/catalog/:id` | Admin | Delete (204) |
| `GET /api/search?q=` | — | Search titles/descriptions (400 without `q`) |
| `GET /api/play/:id/master.m3u8` | — | HLS playlist for a title (404 if it has no stream) |
| `GET /api/play/:id/:segment` | — | `.ts` segment (only `.m3u8`/`.ts`, no traversal) |

## TV clients

All three clients talk to the same backend API. Change one setting in each
to point at your backend host:

- **Roku** — `roku/`: sideload the channel (Developer Mode → zip the
  `roku/` contents). Set `apiBaseUrl` in `source/main.brs`.
  Home grid (`HomeScene`) → details (`DetailsScene`) → HLS player
  (`VideoScene`, Roku's built-in `Video` node).
- **Android TV / Fire TV** — `android-tv/`: open in Android Studio.
  Set `ApiClient.baseUrl`. Leanback browse → details → ExoPlayer (Media3)
  playback. Also runs on Fire TV (same Leanback APIs).
- **Apple TV** — `apple-tv/`: open in Xcode (tvOS target).
  Set `ContentService.baseURL`. SwiftUI grid → details → `AVPlayer`
  (`VideoPlayer`) playback.

## Adding your own content

1. Transcode a video to HLS, e.g.:
   ```bash
   ffmpeg -i input.mp4 -c:v libx264 -c:a aac -hls_time 6 \
     -hls_playlist_type vod -hls_segment_filename "content/mymovie/segment%03d.ts" \
     content/mymovie/master.m3u8
   ```
2. Create a catalog entry (as admin) with `"hls_path": "mymovie/master.m3u8"`.
3. Play it: `GET /api/play/<id>/master.m3u8`.

## Known limits (honest)

- **TV apps are code-complete only.** The build VM has no Roku SDK, no
  Android SDK, and no Xcode, so the Roku, Android TV, and Apple TV apps
  were **never compiled, sideloaded, or run**. They are real, complete
  client code written against the backend's actual API — but treat them as
  unverified until someone builds them on the real toolchains.
- **Admin dashboard: build verified, browser run not verified.** `tsc + vite build`
  passes; the dashboard was not exercised in a browser against a live backend here.
- **Only one playable title.** The bundled sample is a 12-second ffmpeg
  test-pattern clip. Real catalog titles need real HLS assets (see above).
- **No DRM, no payments, no recommendations, no user profiles.** v0.1 is a
  starter kit, not a production streaming service.
- **Playback is unauthenticated** in v0.1 (anyone with the URL can play a
  stream). Add token-checked playback before exposing the backend publicly.
- **No rate limiting, no HTTPS termination.** Put the backend behind a
  reverse proxy (e.g. Caddy/nginx) in production and set `OTT_JWT_SECRET`.
- **SQLite, single file.** Fine for a starter kit; move to Postgres if you
  outgrow one server.
- **Posters are URLs only** — there is no poster upload endpoint yet.
- The CI workflow (`.github/workflows/ci.yml`) runs backend tests and the
  admin build on every push; it was not executed here (no GitHub access in
  the build VM).

## Project layout

```
backend/src/        Express app (app.ts), auth (auth.ts), SQLite (db.ts),
                    validation (validate.ts), server entry (server.ts)
backend/test/       API tests (node:test, real server, throwaway DB)
content/sample/     Bundled 12 s HLS asset (master.m3u8 + 2 segments)
roku/               BrightScript/SceneGraph channel + manifest
android-tv/         Kotlin/Leanback app (Gradle project)
apple-tv/           Swift/SwiftUI tvOS app
admin/              React + Vite admin dashboard
.github/workflows/  CI: backend tests + admin build
```

Built by Tahir Younas — Penetration Tester & Application Security Engineer — https://www.linkedin.com/in/tahiryounas604 | Tytechlabs
