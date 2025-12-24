import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";

const dbPath = path.join(process.cwd(), "data", "registry.db");
const dataDir = path.dirname(dbPath);

/**
 * Run database migrations
 * Can be called manually (bun run db:migrate) or automatically on startup
 */
export async function runMigrations(silent = false): Promise<void> {
  // Check if database exists
  const dbExists = fs.existsSync(dbPath);
  
  if (!dbExists && !silent) {
    console.log("📦 Database not found. Creating and running migrations...");
  }

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(dbPath, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");

  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Create sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Create passkey_verifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS passkey_verifications (
      id TEXT PRIMARY KEY NOT NULL,
      user_id INTEGER NOT NULL,
      challenge TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create passkeys table
  db.exec(`
    CREATE TABLE IF NOT EXISTS passkeys (
      id TEXT PRIMARY KEY NOT NULL,
      user_id INTEGER NOT NULL,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter INTEGER DEFAULT 0 NOT NULL,
      transports TEXT,
      device_name TEXT,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON passkeys(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS passkeys_credential_id_unique ON passkeys(credential_id);
  `);

  db.close();

  if (!silent) {
    console.log("✅ Database migrations completed successfully!");
    console.log(`   Database path: ${dbPath}`);
  }
}

// Run migrations when script is executed directly
if (import.meta.main) {
  runMigrations().catch(console.error);
}
