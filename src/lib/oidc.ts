import { and, eq, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSession, createToken, setAuthCookie } from "./auth";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "./pkce";

export interface OIDCSettings {
  enabled: boolean;
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  usernameClaim: string; // e.g., "preferred_username", "email", "sub"
  autoCreateUsers: boolean;
  defaultRole: "user" | "admin";
}

export interface OIDCEndpoints {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri: string;
  issuer: string;
}

export interface TokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
}

export interface IdTokenClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  [key: string]: unknown;
}

interface JWK {
  kty: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
}

interface JWKS {
  keys: JWK[];
}

const OIDC_SETTINGS_KEY = "oidc";
const STATE_EXPIRY_MINUTES = 10;

// Cache for OIDC discovery and JWKS
let discoveryCache: { endpoints: OIDCEndpoints; expiresAt: number } | null =
  null;
let jwksCache: { jwks: JWKS; expiresAt: number } | null = null;

/**
 * Get OIDC configuration from database
 */
export async function getOIDCConfig(): Promise<OIDCSettings | null> {
  const setting = await db.query.settings.findFirst({
    where: eq(schema.settings.key, OIDC_SETTINGS_KEY),
  });

  if (!setting) {
    return null;
  }

  try {
    return JSON.parse(setting.value) as OIDCSettings;
  } catch {
    return null;
  }
}

/**
 * Save OIDC configuration to database
 */
export async function saveOIDCConfig(config: OIDCSettings): Promise<void> {
  const value = JSON.stringify(config);

  await db
    .insert(schema.settings)
    .values({
      key: OIDC_SETTINGS_KEY,
      value,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: {
        value,
        updatedAt: new Date(),
      },
    });

  // Clear discovery cache when config changes
  discoveryCache = null;
  jwksCache = null;
}

/**
 * Fetch OIDC provider's well-known configuration
 */
export async function discoverOIDCEndpoints(
  issuerUrl: string,
): Promise<OIDCEndpoints> {
  // Check cache
  if (discoveryCache && discoveryCache.expiresAt > Date.now()) {
    return discoveryCache.endpoints;
  }

  const wellKnownUrl = `${issuerUrl.replace(/\/$/, "")}/.well-known/openid-configuration`;

  const response = await fetch(wellKnownUrl, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch OIDC discovery document: ${response.status} ${response.statusText}`,
    );
  }

  const endpoints = (await response.json()) as OIDCEndpoints;

  // Validate required fields
  if (
    !endpoints.authorization_endpoint ||
    !endpoints.token_endpoint ||
    !endpoints.jwks_uri
  ) {
    throw new Error(
      "Invalid OIDC discovery document: missing required endpoints",
    );
  }

  // Cache for 1 hour
  discoveryCache = {
    endpoints,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };

  return endpoints;
}

/**
 * Fetch JWKS (JSON Web Key Set) from the OIDC provider
 */
async function fetchJWKS(jwksUri: string): Promise<JWKS> {
  // Check cache
  if (jwksCache && jwksCache.expiresAt > Date.now()) {
    return jwksCache.jwks;
  }

  const response = await fetch(jwksUri, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`);
  }

  const jwks = (await response.json()) as JWKS;

  // Cache for 1 hour
  jwksCache = {
    jwks,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };

  return jwks;
}

/**
 * Create OAuth state and store it in the database
 */
export async function createOAuthState(
  redirectUri?: string,
): Promise<{ state: string; codeVerifier: string }> {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const expiresAt = new Date(Date.now() + STATE_EXPIRY_MINUTES * 60 * 1000);

  await db.insert(schema.oauthStates).values({
    id: state,
    codeVerifier,
    redirectUri,
    expiresAt,
  });

  return { state, codeVerifier };
}

/**
 * Verify and consume OAuth state from the database
 */
export async function verifyOAuthState(
  state: string,
): Promise<{ codeVerifier: string; redirectUri?: string | null } | null> {
  const oauthState = await db.query.oauthStates.findFirst({
    where: eq(schema.oauthStates.id, state),
  });

  if (!oauthState) {
    return null;
  }

  // Delete the state (single-use)
  await db.delete(schema.oauthStates).where(eq(schema.oauthStates.id, state));

  // Check expiry
  if (oauthState.expiresAt < new Date()) {
    return null;
  }

  return {
    codeVerifier: oauthState.codeVerifier,
    redirectUri: oauthState.redirectUri,
  };
}

/**
 * Clean up expired OAuth states
 */
export async function cleanupExpiredStates(): Promise<void> {
  await db
    .delete(schema.oauthStates)
    .where(lt(schema.oauthStates.expiresAt, new Date()));
}

/**
 * Generate the authorization URL for the OIDC provider
 */
export async function generateAuthorizationUrl(
  config: OIDCSettings,
  state: string,
  codeVerifier: string,
  callbackUrl: string,
): Promise<string> {
  const endpoints = await discoverOIDCEndpoints(config.issuerUrl);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: callbackUrl,
    scope: "openid profile email",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${endpoints.authorization_endpoint}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  config: OIDCSettings,
  code: string,
  codeVerifier: string,
  callbackUrl: string,
): Promise<TokenResponse> {
  const endpoints = await discoverOIDCEndpoints(config.issuerUrl);

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: codeVerifier,
  });

  const response = await fetch(endpoints.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${error}`);
  }

  return response.json() as Promise<TokenResponse>;
}

/**
 * Decode JWT without verification (for extracting header/payload)
 */
function decodeJwt(token: string): {
  header: Record<string, unknown>;
  payload: IdTokenClaims;
} {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

  return { header, payload };
}

const EC_CURVES: Record<string, string> = {
  ES256: "P-256",
  ES384: "P-384",
  ES512: "P-521",
};

function getAlgorithmParams(algorithm: string): {
  importParams: RsaHashedImportParams | EcKeyImportParams;
  verifyParams: AlgorithmIdentifier | RsaPssParams | EcdsaParams;
} {
  const hashBits = algorithm.slice(2);
  const hashName = `SHA-${hashBits}`;

  if (algorithm.startsWith("RS")) {
    return {
      importParams: { name: "RSASSA-PKCS1-v1_5", hash: { name: hashName } },
      verifyParams: { name: "RSASSA-PKCS1-v1_5" },
    };
  }

  if (algorithm.startsWith("PS")) {
    return {
      importParams: { name: "RSA-PSS", hash: { name: hashName } },
      verifyParams: {
        name: "RSA-PSS",
        saltLength: Number.parseInt(hashBits, 10) / 8,
      },
    };
  }

  if (algorithm.startsWith("ES")) {
    return {
      importParams: {
        name: "ECDSA",
        namedCurve: EC_CURVES[algorithm] || "P-256",
      },
      verifyParams: { name: "ECDSA", hash: { name: hashName } },
    };
  }

  throw new Error(`Unsupported algorithm: ${algorithm}`);
}

/**
 * Import a JWK as a CryptoKey for verification
 */
async function importJwk(jwk: JWK): Promise<CryptoKey> {
  const algorithm = jwk.alg || "RS256";
  const { importParams } = getAlgorithmParams(algorithm);

  return crypto.subtle.importKey("jwk", jwk as JsonWebKey, importParams, true, [
    "verify",
  ]);
}

/**
 * Verify JWT signature using JWKS
 */
async function verifyJwtSignature(
  token: string,
  jwksUri: string,
): Promise<boolean> {
  const { header } = decodeJwt(token);
  const jwks = await fetchJWKS(jwksUri);

  // Find the matching key
  const kid = header.kid as string | undefined;
  let key = jwks.keys.find((k) => k.kid === kid);

  // If no kid match, try the first signing key
  if (!key) {
    key = jwks.keys.find((k) => k.use === "sig" || !k.use);
  }

  if (!key) {
    throw new Error("No matching key found in JWKS");
  }

  const parts = token.split(".");
  const signatureInput = `${parts[0]}.${parts[1]}`;
  const signature = Buffer.from(parts[2], "base64url");

  const cryptoKey = await importJwk(key);
  const algorithm = key.alg || "RS256";
  const { verifyParams } = getAlgorithmParams(algorithm);

  return crypto.subtle.verify(
    verifyParams,
    cryptoKey,
    signature,
    new TextEncoder().encode(signatureInput),
  );
}

/**
 * Verify ID token claims and signature
 */
export async function verifyIdToken(
  idToken: string,
  config: OIDCSettings,
): Promise<IdTokenClaims> {
  const endpoints = await discoverOIDCEndpoints(config.issuerUrl);

  // Verify signature
  const signatureValid = await verifyJwtSignature(idToken, endpoints.jwks_uri);
  if (!signatureValid) {
    throw new Error("Invalid ID token signature");
  }

  const { payload } = decodeJwt(idToken);

  // Verify issuer
  const expectedIssuer = endpoints.issuer || config.issuerUrl;
  if (
    payload.iss !== expectedIssuer &&
    payload.iss !== expectedIssuer.replace(/\/$/, "")
  ) {
    throw new Error(
      `Invalid issuer: expected ${expectedIssuer}, got ${payload.iss}`,
    );
  }

  // Verify audience
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(config.clientId)) {
    throw new Error(
      `Invalid audience: ${config.clientId} not in ${aud.join(", ")}`,
    );
  }

  // Verify expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error("ID token has expired");
  }

  // Verify issued at (allow 5 minute clock skew)
  if (payload.iat > now + 300) {
    throw new Error("ID token issued in the future");
  }

  return payload;
}

/**
 * Extract user info from ID token based on configured username claim
 */
export function getUserInfoFromToken(
  claims: IdTokenClaims,
  usernameClaim: string,
): { username: string; email?: string; name?: string; sub: string } {
  let rawUsername: string | undefined;

  if (usernameClaim === "sub") {
    rawUsername = claims.sub;
  } else if (usernameClaim === "email") {
    rawUsername = claims.email?.split("@")[0];
  } else {
    const claimValue = claims[usernameClaim];
    rawUsername = typeof claimValue === "string" ? claimValue : undefined;
  }

  if (!rawUsername) {
    throw new Error(`Claim "${usernameClaim}" not present in ID token`);
  }

  // Sanitize username for our system
  const username = rawUsername.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();

  return {
    username,
    email: claims.email,
    name: claims.name,
    sub: claims.sub,
  };
}

/**
 * Find existing user by OAuth account or create new user
 */
export async function findOrCreateOIDCUser(
  userInfo: { username: string; email?: string; name?: string; sub: string },
  config: OIDCSettings,
): Promise<{ user: typeof schema.users.$inferSelect; isNew: boolean }> {
  // First, check if we have an existing OAuth account with this sub
  const existingOAuthAccount = await db.query.oauthAccounts.findFirst({
    where: and(
      eq(schema.oauthAccounts.provider, "oidc"),
      eq(schema.oauthAccounts.providerAccountId, userInfo.sub),
    ),
  });

  if (existingOAuthAccount) {
    // Get the linked user
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, existingOAuthAccount.userId),
    });

    if (!user) {
      // Orphaned OAuth account, shouldn't happen due to cascade delete
      throw new Error("OAuth account exists but user not found");
    }

    // Update OAuth account info if changed
    await db
      .update(schema.oauthAccounts)
      .set({
        providerUsername: userInfo.username,
        email: userInfo.email,
        name: userInfo.name,
        updatedAt: new Date(),
      })
      .where(eq(schema.oauthAccounts.id, existingOAuthAccount.id));

    return { user, isNew: false };
  }

  // No existing OAuth account, try to find a matching user by username
  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.username, userInfo.username),
  });

  if (existingUser) {
    // Link the OAuth account to the existing user
    await db.insert(schema.oauthAccounts).values({
      id: crypto.randomUUID(),
      userId: existingUser.id,
      provider: "oidc",
      providerAccountId: userInfo.sub,
      providerUsername: userInfo.username,
      email: userInfo.email,
      name: userInfo.name,
    });

    return { user: existingUser, isNew: false };
  }

  // No existing user found
  if (!config.autoCreateUsers) {
    throw new Error(
      `No existing user found with username "${userInfo.username}" and auto-creation is disabled`,
    );
  }

  // Create new user
  const email = userInfo.email || `${userInfo.username}@oidc.local`;

  // Ensure unique email
  const existingEmailUser = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  if (existingEmailUser) {
    throw new Error(
      `Cannot create user: email "${email}" is already in use by another account`,
    );
  }

  const [newUser] = await db
    .insert(schema.users)
    .values({
      username: userInfo.username,
      email,
      passwordHash: null, // OIDC-only user
      role: config.defaultRole,
    })
    .returning();

  // Create default namespace for the new user
  await db.insert(schema.namespaces).values({
    name: userInfo.username,
    userId: newUser.id,
    isDefault: true,
  });

  // Link OAuth account
  await db.insert(schema.oauthAccounts).values({
    id: crypto.randomUUID(),
    userId: newUser.id,
    provider: "oidc",
    providerAccountId: userInfo.sub,
    providerUsername: userInfo.username,
    email: userInfo.email,
    name: userInfo.name,
  });

  return { user: newUser, isNew: true };
}

/**
 * Complete OIDC login flow - create session and set auth cookie
 */
export async function completeOIDCLogin(
  user: typeof schema.users.$inferSelect,
): Promise<void> {
  const sessionId = await createSession(user.id);

  const token = await createToken({
    userId: user.id,
    username: user.username,
    role: user.role as "admin" | "user",
    sessionId,
  });

  await setAuthCookie(token);
}
