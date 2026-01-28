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
  db.run("PRAGMA journal_mode = WAL;");
  db.run("PRAGMA foreign_keys = ON;");

  // Create users table (password_hash is nullable to support OIDC-only users)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Create sessions table
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Create passkey_verifications table
  db.run(`
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
  db.run(`
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

  // Create access_tokens table
  db.run(`
    CREATE TABLE IF NOT EXISTS access_tokens (
      id TEXT PRIMARY KEY NOT NULL,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      permissions TEXT NOT NULL DEFAULT 'pull',
      last_used_at INTEGER,
      expires_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create namespaces table
  db.run(`
    CREATE TABLE IF NOT EXISTS namespaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      description TEXT,
      is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0, 1)),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create registry_cache table for caching registry data
  db.run(`
    CREATE TABLE IF NOT EXISTS registry_cache (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Create registry_sync_lock table for preventing concurrent syncs
  db.run(`
    CREATE TABLE IF NOT EXISTS registry_sync_lock (
      id TEXT PRIMARY KEY DEFAULT 'sync_lock',
      locked_at INTEGER,
      locked_by TEXT,
      expires_at INTEGER
    );
  `);

  // Create settings table for application-wide settings (including OIDC config)
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Create oauth_accounts table for linked OAuth accounts
  db.run(`
    CREATE TABLE IF NOT EXISTS oauth_accounts (
      id TEXT PRIMARY KEY NOT NULL,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      provider_username TEXT,
      email TEXT,
      name TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create oauth_states table for CSRF protection during OAuth flow
  db.run(`
    CREATE TABLE IF NOT EXISTS oauth_states (
      id TEXT PRIMARY KEY NOT NULL,
      code_verifier TEXT NOT NULL,
      redirect_uri TEXT,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Create indexes for better performance
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON passkeys(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS passkeys_credential_id_unique ON passkeys(credential_id);
    CREATE INDEX IF NOT EXISTS idx_access_tokens_user_id ON access_tokens(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS access_tokens_token_hash_unique ON access_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_access_tokens_expires_at ON access_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_namespaces_user_id ON namespaces(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS namespaces_name_unique ON namespaces(name);
    CREATE INDEX IF NOT EXISTS idx_namespaces_is_default ON namespaces(is_default);
    CREATE INDEX IF NOT EXISTS idx_registry_cache_expires_at ON registry_cache(expires_at);
    CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON oauth_accounts(provider);
    CREATE UNIQUE INDEX IF NOT EXISTS oauth_accounts_provider_account_unique ON oauth_accounts(provider, provider_account_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);
  `);

  db.close();

  if (!silent) {
    console.log("✅ Database migrations completed successfully!");
    console.log(`   Database path: ${dbPath}`);
  }

  // Generate registry certificates if they don't exist
  const { generateRegistryCertificates } = await import("@/lib/setup");
  await generateRegistryCertificates();
}

// Run migrations when script is executed directly
if (import.meta.main) {
  runMigrations().catch(console.error);
}
