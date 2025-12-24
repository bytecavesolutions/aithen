import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";

const dbPath = path.join(process.cwd(), "data", "registry.db");
const dataDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath, { create: true });

async function seed() {
  console.log("🌱 Database seeding is no longer needed.");
  console.log(
    "⚠️  On first startup, you will be prompted to create an admin user.",
  );
  console.log("   Visit /setup to configure your administrator account.\n");

  db.close();
}

seed().catch(console.error);
