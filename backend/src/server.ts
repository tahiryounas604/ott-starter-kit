// Server entry point. Configuration via environment:
//   PORT (default 3000), OTT_DB_PATH (default ./data/ott.db),
//   OTT_CONTENT_DIR (default ./content), OTT_JWT_SECRET (required in production),
//   OTT_ADMIN_EMAIL / OTT_ADMIN_PASSWORD (seeded admin if no users exist).
import path from "node:path";
import { createApp } from "./app";
import { openDb } from "./db";
import { hashPassword } from "./auth";

// Runs from the project root (npm start / npm run dev), so the project root
// is the working directory.
const root = process.cwd();
const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.OTT_DB_PATH ?? path.join(root, "data", "ott.db");
const contentDir = process.env.OTT_CONTENT_DIR ?? path.join(root, "content");

async function seedAdminIfNeeded(): Promise<void> {
  const email = process.env.OTT_ADMIN_EMAIL;
  const password = process.env.OTT_ADMIN_PASSWORD;
  if (!email || !password) return;
  const db = openDb(dbPath);
  try {
    const count = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
    if (count.n === 0) {
      db.prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'admin')").run(
        email.trim().toLowerCase(),
        "Admin",
        hashPassword(password),
      );
      console.log(`Seeded admin user ${email}.`);
    }
  } finally {
    db.close();
  }
}

async function main(): Promise<void> {
  await seedAdminIfNeeded();
  const app = createApp({ dbPath, contentDir });
  app.listen(port, () => {
    console.log(`ott-starter-kit listening on http://localhost:${port}`);
    console.log(`Content directory: ${contentDir}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
