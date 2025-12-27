import { Database } from "bun:sqlite";
import path from "node:path";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { runMigrations } from "./migrate";
import * as schema from "./schema";

const dbPath = path.join(process.cwd(), "data", "registry.db");

// Skip database initialization during Next.js build
const isBuildTime = process.env.NEXT_PHASE === "phase-production-build";

let sqlite: Database | null = null;
let dbInstance: BunSQLiteDatabase<typeof schema> | null = null;

if (!isBuildTime) {
  // Auto-run migrations on first startup (silent mode)
  await runMigrations(true);

  sqlite = new Database(dbPath, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  dbInstance = drizzle(sqlite, { schema });
}

// Export a proxy that throws helpful errors during build time
export const db = dbInstance as BunSQLiteDatabase<typeof schema>;

export { schema };
