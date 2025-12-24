import { Database } from "bun:sqlite";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

const dbPath = path.join(process.cwd(), "data", "registry.db");
const dataDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath, { create: true });

// Default admin credentials
const DEFAULT_ADMIN = {
  username: "admin",
  email: "admin@localhost",
  password: "admin123",
  role: "admin",
};

async function seed() {
  console.log("🌱 Seeding database...\n");

  // Check if admin already exists
  const existingAdmin = db
    .query("SELECT id FROM users WHERE username = ?")
    .get(DEFAULT_ADMIN.username);

  if (existingAdmin) {
    console.log("⚠️  Admin user already exists. Skipping seed.");
    db.close();
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, 12);

  // Insert admin user
  const stmt = db.prepare(`
    INSERT INTO users (username, email, password_hash, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, unixepoch(), unixepoch())
  `);

  stmt.run(
    DEFAULT_ADMIN.username,
    DEFAULT_ADMIN.email,
    passwordHash,
    DEFAULT_ADMIN.role,
  );

  console.log("✅ Created default admin user:");
  console.log(`   Username: ${DEFAULT_ADMIN.username}`);
  console.log(`   Password: ${DEFAULT_ADMIN.password}`);
  console.log(`   Email: ${DEFAULT_ADMIN.email}`);
  console.log("\n⚠️  Please change the password after first login!\n");

  db.close();
}

seed().catch(console.error);
