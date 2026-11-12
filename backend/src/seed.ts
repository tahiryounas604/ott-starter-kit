// `npm run seed` — opens the database (creating + seeding catalog content
// if empty) and prints a summary. The server does this automatically on
// start; this script exists for operators who want to pre-seed.
import path from "node:path";
import { openDb } from "./db";

const root = process.cwd();
const dbPath = process.env.OTT_DB_PATH ?? path.join(root, "data", "ott.db");
const db = openDb(dbPath);
const content = db.prepare("SELECT COUNT(*) AS n FROM content").get() as { n: number };
const users = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
console.log(`Database: ${dbPath}`);
console.log(`Content titles: ${content.n}, users: ${users.n}`);
db.close();
