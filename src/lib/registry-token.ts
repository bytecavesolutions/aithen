import * as fs from "node:fs";
import * as path from "node:path";
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";
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
); // 5 minutes default

// Paths to certificates (relative to project root)
const PRIVATE_KEY_PATH =
  process.env.REGISTRY_PRIVATE_KEY_PATH || "./certs/registry.key";
const PUBLIC_CERT_PATH =
  process.env.REGISTRY_PUBLIC_CERT_PATH || "./certs/registry.crt";

// Cache for loaded keys
let privateKey: Awaited<ReturnType<typeof importPKCS8>> | null = null;
let publicKey: Awaited<ReturnType<typeof importSPKI>> | null = null;

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
  publicKey = await importSPKI(certContent, "RS256");
  return publicKey;
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
 * Check if a user has permission to access a repository
 * Users can only access repositories in their own namespace (username/)
 * Admins can access all repositories
 */
export function checkRepositoryAccess(
  repositoryName: string,
  username: string,
  isAdmin: boolean,
  requestedActions: string[],
): string[] {
  // Admins have full access to everything
  if (isAdmin) {
    return requestedActions;
  }

  // Extract namespace from repository name
  const nameParts = repositoryName.split("/");

  // If no namespace (just "imagename"), only admin can access
  if (nameParts.length === 1) {
    return []; // No access for regular users to root-level repos
  }

  const namespace = nameParts[0];

  // Users can only access their own namespace
  if (namespace.toLowerCase() === username.toLowerCase()) {
    return requestedActions;
  }

  // No access to other users' repositories
  return [];
}

/**
 * Generate granted access based on user permissions
 */
export function generateGrantedAccess(
  scopes: ParsedScope[],
  username: string,
  isAdmin: boolean,
): TokenAccess[] {
  const access: TokenAccess[] = [];

  for (const scope of scopes) {
    if (scope.type === "repository") {
      const grantedActions = checkRepositoryAccess(
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

  const token = await new SignJWT({
    access,
  } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
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
