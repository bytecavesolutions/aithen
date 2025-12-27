#!/usr/bin/env bun
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

console.log("📦 Copying static files for standalone build...");

const rootDir = process.cwd();
const standaloneDir = join(rootDir, ".next", "standalone");
const staticDir = join(rootDir, ".next", "static");
const publicDir = join(rootDir, "public");

// Copy .next/static to .next/standalone/.next/static
const targetStaticDir = join(standaloneDir, ".next", "static");
if (existsSync(staticDir)) {
  console.log("  → Copying .next/static to .next/standalone/.next/static");
  mkdirSync(join(standaloneDir, ".next"), { recursive: true });
  cpSync(staticDir, targetStaticDir, { recursive: true });
  console.log("  ✓ Static files copied");
} else {
  console.warn("  ⚠ .next/static directory not found");
}

// Copy public to .next/standalone/public
const targetPublicDir = join(standaloneDir, "public");
if (existsSync(publicDir)) {
  console.log("  → Copying public to .next/standalone/public");
  cpSync(publicDir, targetPublicDir, { recursive: true });
  console.log("  ✓ Public files copied");
} else {
  console.log("  ℹ No public directory found (skipping)");
}

console.log("✅ Post-build complete!");
