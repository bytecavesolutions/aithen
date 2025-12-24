import { Database } from "bun:sqlite";
import path from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { runMigrations } from "./migrate";
import * as schema from "./schema";

const dbPath = path.join(process.cwd(), "data", "registry.db");

// Auto-run migrations on first startup (silent mode)
await runMigrations(true);

const sqlite = new Database(dbPath, { create: true });
sqlite.exec("PRAGMA journal_mode = WAL;");

export const db = drizzle(sqlite, { schema });

export { schema };
