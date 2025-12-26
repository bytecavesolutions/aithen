import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { importPKCS8, importSPKI, importX509, jwtVerify, SignJWT } from "jose";
import type {
  ParsedScope,
  RegistryTokenClaims,
  TokenAccess,
  TokenResponse,
} from "@/types/registry";

// Configuration from environment
const REGISTRY_SERVICE = process.env.REGISTRY_SERVICE_NAME || "aithen-registry";
const REGISTRY_TOKEN_ISSUER =
  process.env.REGISTRY_TOKEN_ISSUER || "aithen-auth";
const REGISTRY_TOKEN_EXPIRY = Number.parseInt(
  process.env.REGISTRY_TOKEN_EXPIRY || "300",
  10,
); // 5 minutes default (short-lived access token)
const REGISTRY_REFRESH_TOKEN_EXPIRY = Number.parseInt(
  process.env.REGISTRY_REFRESH_TOKEN_EXPIRY || "604800",
  10,
); // 7 days default for refresh tokens

// Paths to certificates (relative to project root)
const PRIVATE_KEY_PATH =
  process.env.REGISTRY_PRIVATE_KEY_PATH || "./certs/registry.key";
const PUBLIC_CERT_PATH =
  process.env.REGISTRY_PUBLIC_CERT_PATH || "./certs/registry.crt";

// Cache for loaded keys
let privateKey: Awaited<ReturnType<typeof importPKCS8>> | null = null;
let publicKey: Awaited<ReturnType<typeof importSPKI>> | null = null;
let rsaPublicKey: crypto.KeyObject | null = null;
let cachedKid: string | null = null;

/**
 * Compute the JWK Thumbprint (RFC 7638) for a public key
 * This is how Docker Registry v3 computes the "kid" from a certificate
 */
function computeJWKThumbprint(pubKey: crypto.KeyObject): string {
  const jwk = pubKey.export({ format: "jwk" }) as {
    kty: string;
    n?: string;
    e?: string;
    crv?: string;
    x?: string;
    y?: string;
  };

  let payload: string;

  if (jwk.kty === "RSA" && jwk.n && jwk.e) {
    // RSA key - keys must be in lexicographical order: e, kty, n
    // Use manual string construction to ensure exact order (JSON.stringify may reorder)
    payload = `{"e":"${jwk.e}","kty":"RSA","n":"${jwk.n}"}`;
  } else if (jwk.kty === "EC" && jwk.crv && jwk.x && jwk.y) {
    // ECDSA key - keys must be in lexicographical order: crv, kty, x, y
    payload = `{"crv":"${jwk.crv}","kty":"EC","x":"${jwk.x}","y":"${jwk.y}"}`;
  } else {
    throw new Error(`Unsupported key type: ${jwk.kty}`);
  }

  // SHA-256 hash of the JSON payload
  const hash = crypto.createHash("sha256").update(payload).digest();

  // Base64url encode without padding
  return hash.toString("base64url");
}

/**
 * Load the private key for signing tokens
 */
async function getPrivateKey() {
  if (privateKey) return privateKey;

  const keyPath = path.resolve(process.cwd(), PRIVATE_KEY_PATH);

  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `Registry private key not found at ${keyPath}. Certificates should be auto-generated during database initialization.`,
    );
  }

  const keyContent = fs.readFileSync(keyPath, "utf-8");
  privateKey = await importPKCS8(keyContent, "RS256");
  return privateKey;
}

/**
 * Load the public key for verifying tokens
 */
async function getPublicKey() {
  if (publicKey) return publicKey;

  const certPath = path.resolve(process.cwd(), PUBLIC_CERT_PATH);

  if (!fs.existsSync(certPath)) {
    throw new Error(
      `Registry public certificate not found at ${certPath}. Certificates should be auto-generated during database initialization.`,
    );
  }

  const certContent = fs.readFileSync(certPath, "utf-8");

  // Handle both x509 certificate and raw public key formats
  if (certContent.includes("-----BEGIN CERTIFICATE-----")) {
    publicKey = await importX509(certContent, "RS256");
    // Also cache the crypto.KeyObject for JWKS and kid computation
    const x509 = new crypto.X509Certificate(certContent);
    rsaPublicKey = x509.publicKey;
    // Compute and cache the JWK Thumbprint (kid) for this certificate
    cachedKid = computeJWKThumbprint(rsaPublicKey);
  } else {
    // Fallback for raw SPKI public keys (legacy format)
    publicKey = await importSPKI(certContent, "RS256");
    rsaPublicKey = crypto.createPublicKey(certContent);
    cachedKid = computeJWKThumbprint(rsaPublicKey);
  }

  return publicKey;
}

/**
 * Get the computed kid (JWK Thumbprint) for the current certificate
 */
async function getKid(): Promise<string> {
  if (!cachedKid) {
    await getPublicKey();
  }
  if (!cachedKid) {
    throw new Error("Failed to compute key ID");
  }
  return cachedKid;
}

/**
 * Parse scope string from registry token request
 * Format: type:name:actions (e.g., "repository:username/repo:pull,push")
 */
export function parseScope(scope: string): ParsedScope | null {
  const parts = scope.split(":");
  if (parts.length < 3) return null;

  const type = parts[0] as "repository" | "registry";
  const name = parts.slice(1, -1).join(":"); // Handle names with colons
  const actions = parts[parts.length - 1].split(",");

  return { type, name, actions };
}

/**
 * Parse multiple scopes from request
 */
export function parseScopes(
  scope: string | string[] | undefined,
): ParsedScope[] {
  if (!scope) return [];

  const scopes = Array.isArray(scope) ? scope : [scope];
  return scopes.map(parseScope).filter((s): s is ParsedScope => s !== null);
}

/**
 * Check if a user has permission to access a repository based on their namespaces
 * - Admins can pull (read) from any repository (including orphans for management)
 * - Admins can only push to existing namespaces
 * - Users can only access namespaces they own (which must exist)
 */
export async function checkRepositoryAccess(
  repositoryName: string,
  username: string,
  isAdmin: boolean,
  requestedActions: string[],
): Promise<string[]> {
  // Extract namespace from repository name
  const nameParts = repositoryName.split("/");

  // If no namespace (just "imagename"), deny access
  // All repositories must be namespaced
  if (nameParts.length === 1) {
    console.log(
      `[checkRepositoryAccess] Denied: Repository "${repositoryName}" has no namespace.`,
    );
    return []; // No access to root-level repos
  }

  const namespace = nameParts[0];
  const namespaceLower = namespace.toLowerCase();

  console.log(
    `[checkRepositoryAccess] Checking access for user="${username}" isAdmin=${isAdmin} repo="${repositoryName}" namespace="${namespace}" actions=${JSON.stringify(requestedActions)}`,
  );

  try {
    const { db, schema } = await import("@/db");

    // Get all namespaces and do case-insensitive comparison
    // (SQLite LIKE is case-insensitive for ASCII, but we do it in JS to be safe)
    const allNamespaces = await db.query.namespaces.findMany({
      columns: { id: true, name: true, userId: true },
    });

    const existingNamespace = allNamespaces.find(
      (ns) => ns.name.toLowerCase() === namespaceLower,
    );

    const namespaceExists = !!existingNamespace;

    console.log(
      `[checkRepositoryAccess] Namespace "${namespace}" exists: ${namespaceExists}`,
    );

    // For admins:
    // - Allow pull/delete on any repo (so they can view and clean up orphans)
    // - Only allow push if namespace exists (prevent creating new orphans)
    if (isAdmin) {
      if (!namespaceExists) {
        // Filter out "push" action for non-existent namespaces
        const allowedActions = requestedActions.filter(
          (action) => action !== "push",
        );
        console.log(
          `[checkRepositoryAccess] Admin on orphan namespace "${namespace}": allowed=${JSON.stringify(allowedActions)}`,
        );
        return allowedActions;
      }
      // Namespace exists, admin gets full access
      console.log(
        `[checkRepositoryAccess] Admin granted full access to "${repositoryName}"`,
      );
      return requestedActions;
    }

    // For regular users: namespace must exist AND they must own it
    if (!namespaceExists) {
      console.log(
        `[checkRepositoryAccess] User "${username}" denied: namespace "${namespace}" does not exist.`,
      );
      return [];
    }

    // Check if user owns the namespace
    const { eq } = await import("drizzle-orm");
    const user = await db.query.users.findFirst({
      where: eq(schema.users.username, username),
      columns: { id: true },
    });

    if (!user) {
      console.log(
        `[checkRepositoryAccess] User "${username}" not found in database.`,
      );
      return [];
    }

    // Check if the user owns this namespace
    const userOwnsNamespace = existingNamespace.userId === user.id;

    if (userOwnsNamespace) {
      console.log(
        `[checkRepositoryAccess] User "${username}" owns namespace "${namespace}", granted: ${JSON.stringify(requestedActions)}`,
      );
      return requestedActions;
    }

    console.log(
      `[checkRepositoryAccess] User "${username}" does not own namespace "${namespace}". Access denied.`,
    );
    return [];
  } catch (error) {
    console.error("[checkRepositoryAccess] Error:", error);
    return []; // Deny access on error
  }
}

/**
 * Generate granted access based on user permissions
 */
export async function generateGrantedAccess(
  scopes: ParsedScope[],
  username: string,
  isAdmin: boolean,
): Promise<TokenAccess[]> {
  const access: TokenAccess[] = [];

  for (const scope of scopes) {
    if (scope.type === "repository") {
      const grantedActions = await checkRepositoryAccess(
        scope.name,
        username,
        isAdmin,
        scope.actions,
      );

      if (grantedActions.length > 0) {
        access.push({
          type: "repository",
          name: scope.name,
          actions: grantedActions as ("push" | "pull" | "delete" | "*")[],
        });
      }
    } else if (scope.type === "registry" && scope.name === "catalog") {
      // Catalog access - admins get full access, users only see their repos
      access.push({
        type: "registry",
        name: "catalog",
        actions: ["*"],
      });
    }
  }

  return access;
}

/**
 * Create a Docker Registry v2 compatible JWT token
 */
export async function createRegistryToken(
  username: string,
  access: TokenAccess[],
): Promise<TokenResponse> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + REGISTRY_TOKEN_EXPIRY;
  const jti = crypto.randomUUID();

  const key = await getPrivateKey();
  // Get the JWK Thumbprint (kid) that Docker Registry v3 expects
  const kid = await getKid();

  // Add kid (key id) header - must be JWK Thumbprint for Docker Registry v3
  const token = await new SignJWT({
    access,
  } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid })
    .setIssuer(REGISTRY_TOKEN_ISSUER)
    .setSubject(username)
    .setAudience(REGISTRY_SERVICE)
    .setExpirationTime(exp)
    .setNotBefore(now)
    .setIssuedAt(now)
    .setJti(jti)
    .sign(key);

  return {
    token,
    access_token: token,
    expires_in: REGISTRY_TOKEN_EXPIRY,
    issued_at: new Date(now * 1000).toISOString(),
  };
}

/**
 * Create a long-lived refresh token for persistent docker login
 * Refresh tokens have longer expiry and minimal access scope
 */
export async function createRefreshToken(
  username: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + REGISTRY_REFRESH_TOKEN_EXPIRY;
  const jti = crypto.randomUUID();

  const key = await getPrivateKey();
  const kid = await getKid();

  // Refresh token has no access scopes - it's only used to get new access tokens
  const token = await new SignJWT({
    token_type: "refresh_token",
  } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid })
    .setIssuer(REGISTRY_TOKEN_ISSUER)
    .setSubject(username)
    .setAudience(REGISTRY_SERVICE)
    .setExpirationTime(exp)
    .setNotBefore(now)
    .setIssuedAt(now)
    .setJti(jti)
    .sign(key);

  return token;
}

/**
 * Verify a registry token
 */
export async function verifyRegistryToken(
  token: string,
): Promise<RegistryTokenClaims | null> {
  try {
    const key = await getPublicKey();
    const { payload } = await jwtVerify(token, key, {
      issuer: REGISTRY_TOKEN_ISSUER,
      audience: REGISTRY_SERVICE,
    });
    return payload as unknown as RegistryTokenClaims;
  } catch {
    return null;
  }
}

/**
 * Get the expected namespace for a user
 */
export function getUserNamespace(username: string): string {
  return username.toLowerCase();
}

/**
 * Check if a repository belongs to a user
 */
export function isUserRepository(
  repositoryName: string,
  username: string,
): boolean {
  const namespace = repositoryName.split("/")[0];
  return namespace?.toLowerCase() === username.toLowerCase();
}
/**
 * JWKS Response type
 */
export interface JWKSResponse {
  keys: JWK[];
}

interface JWK {
  kty: string;
  use: string;
  alg: string;
  kid: string;
  n: string;
  e: string;
}

/**
 * Get JWKS (JSON Web Key Set) for Docker Registry v3 token verification
 * This is the preferred method for registry to verify JWT tokens
 */
export async function getJWKS(): Promise<JWKSResponse> {
  // Ensure public key is loaded and kid is computed
  await getPublicKey();

  if (!rsaPublicKey || !cachedKid) {
    throw new Error("RSA public key not loaded");
  }

  // Export the public key in JWK format
  const jwk = rsaPublicKey.export({ format: "jwk" }) as {
    n: string;
    e: string;
    kty: string;
  };

  return {
    keys: [
      {
        kty: jwk.kty,
        use: "sig",
        alg: "RS256",
        kid: cachedKid, // Use the JWK Thumbprint as kid
        n: jwk.n,
        e: jwk.e,
      },
    ],
  };
}

/**
 * Get the computed key ID (JWK Thumbprint) for the current certificate
 */
export async function getComputedKid(): Promise<string> {
  return getKid();
}

/**
 * Get the token issuer
 */
export function getTokenIssuer(): string {
  return REGISTRY_TOKEN_ISSUER;
}
