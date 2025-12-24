import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Generate RSA key pair for registry token authentication
 * Creates PKCS8 private key and SPKI public key for JWT RS256 signing
 */
export function generateRegistryCertificates(): void {
  const certsDir = path.resolve(process.cwd(), "certs");
  const privateKeyPath = path.join(certsDir, "registry.key");
  const publicCertPath = path.join(certsDir, "registry.crt");

  // Check if certificates already exist
  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicCertPath)) {
    return; // Certificates already exist
  }

  // Create certs directory if it doesn't exist
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
  }

  console.log("🔐 Generating registry authentication certificates...");

  // Generate RSA key pair (4096 bits)
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  // Write private key (PKCS8 format)
  fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });

  // Write public key (SPKI format - compatible with Docker Registry)
  fs.writeFileSync(publicCertPath, publicKey, { mode: 0o644 });

  console.log("✅ Registry certificates generated successfully");
  console.log(`   Private key: ${privateKeyPath}`);
  console.log(`   Public cert: ${publicCertPath}`);
}

/**
 * Check if the application needs initial setup (no admin user exists)
 */
export async function needsSetup(): Promise<boolean> {
  try {
    const { db } = await import("@/db");
    const adminUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.role, "admin"),
    });

    return !adminUser;
  } catch (error) {
    // If there's an error (e.g., table doesn't exist), we need setup
    // This is expected on first run before migrations
    if (error instanceof Error && error.message.includes("no such table")) {
      return true;
    }
    console.error("Error checking setup status:", error);
    return true;
  }
}
