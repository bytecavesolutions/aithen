import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as forge from "node-forge";

/**
 * Generate RSA key pair and self-signed x509 certificate for registry token authentication
 * Uses node-forge for Docker Registry v3 compatible certificate generation
 */
export async function generateRegistryCertificates(): Promise<void> {
  const certsDir = path.resolve(process.cwd(), "certs");
  const privateKeyPath = path.join(certsDir, "registry.key");
  const publicCertPath = path.join(certsDir, "registry.crt");

  // Check if certificates already exist and are valid
  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicCertPath)) {
    try {
      const certContent = fs.readFileSync(publicCertPath, "utf-8");
      const cert = new crypto.X509Certificate(certContent);
      // Check if certificate is still valid
      const now = new Date();
      const validFrom = new Date(cert.validFrom);
      const validTo = new Date(cert.validTo);
      if (now >= validFrom && now <= validTo) {
        return; // Valid certificate exists
      }
      console.log("🔄 Existing certificate expired, regenerating...");
    } catch {
      console.log("🔄 Existing certificate invalid, regenerating...");
    }
  }

  // Create certs directory if it doesn't exist
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true});
  }

  console.log("🔐 Generating registry authentication certificates...");

  // Generate RSA key pair (2048 bits - matches Docker Registry v3 Go implementation)
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });

  // Create a certificate
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  
  // Generate 128-bit random serial number (matches Go implementation)
  // IMPORTANT: Clear the high bit of the first byte to ensure positive serial number
  // In ASN.1 DER encoding, if the high bit is set, the number is interpreted as negative
  const serialBytes = forge.random.getBytesSync(16);
  const serialArray = serialBytes.split("").map((c) => c.charCodeAt(0));
  serialArray[0] &= 0x7f; // Clear high bit to make it positive
  cert.serialNumber = serialArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1); // 1 year like Go

  // Set subject and issuer (same for self-signed)
  // Use token issuer as CommonName to match Go implementation
  const tokenIssuer = process.env.REGISTRY_TOKEN_ISSUER || "aithen-auth";
  const attrs = [
    { name: "organizationName", value: "Docker Registry" },
    { name: "commonName", value: tokenIssuer },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  // Add extensions matching Docker Registry v3 Go implementation exactly
  // Go uses: KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageCodeSigning}
  cert.setExtensions([
    {
      name: "basicConstraints",
      // Go sets BasicConstraintsValid: true but no cA
    },
    {
      name: "keyUsage",
      digitalSignature: true,
    },
    {
      name: "extKeyUsage",
      codeSigning: true,
    },
  ]);

  // Self-sign certificate
  cert.sign(keys.privateKey, forge.md.sha256.create());

  // Convert to PEM format
  const certPem = forge.pki.certificateToPem(cert);
  
  // Convert private key to PKCS#8 format (required by jose library)
  const privateKeyInfo = forge.pki.wrapRsaPrivateKey(
    forge.pki.privateKeyToAsn1(keys.privateKey)
  );
  const privateKeyPem = forge.pki.privateKeyInfoToPem(privateKeyInfo);

  // Write files
  fs.writeFileSync(privateKeyPath, privateKeyPem, { mode: 0o600 });
  fs.writeFileSync(publicCertPath, certPem, { mode: 0o644 });


  console.log("✅ Registry certificates generated successfully");
  console.log(`   Private key: ${privateKeyPath}`);
  console.log(`   Public cert: ${publicCertPath}`);

  // Verify the certificate
  const verifyX509 = new crypto.X509Certificate(certPem);
  console.log(`   Certificate Subject: ${verifyX509.subject}`);
  console.log(`   Valid from: ${verifyX509.validFrom}`);
  console.log(`   Valid to: ${verifyX509.validTo}`);
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
