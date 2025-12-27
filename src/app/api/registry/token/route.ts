import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { verifyAccessToken, verifyPassword } from "@/lib/auth";
import {
  createRegistryToken,
  generateGrantedAccess,
  parseScopes,
} from "@/lib/registry-token";
import type { TokenAccess } from "@/types/registry";

/**
 * Docker Registry Token Service Endpoint
 *
 * This endpoint is called by the Docker registry when a client needs authentication.
 * The registry challenges the client with a 401 and WWW-Authenticate header pointing here.
 *
 * Flow:
 * 1. Docker client tries to access registry
 * 2. Registry returns 401 with realm pointing to this endpoint
 * 3. Client calls this endpoint with Basic auth credentials
 * 4. We validate credentials and return a JWT token
 * 5. Client uses JWT to authenticate with registry
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  // Parse query parameters
  // Use default service name if not provided for compatibility with various Docker clients
  const service =
    url.searchParams.get("service") ||
    process.env.REGISTRY_SERVICE_NAME ||
    "aithen-registry";
  const scope = url.searchParams.getAll("scope");
  const _clientId = url.searchParams.get("client_id");
  const offlineToken = url.searchParams.get("offline_token") === "true";
  const _account = url.searchParams.get("account");

  console.log(
    `[TokenEndpoint] Request: service="${service}" scope=${JSON.stringify(scope)} offlineToken=${offlineToken}`,
  );

  // Extract credentials from Authorization header
  const authHeader = request.headers.get("Authorization");

  let username: string | null = null;
  let password: string | null = null;

  if (authHeader?.startsWith("Basic ")) {
    const base64Credentials = authHeader.slice(6);
    const credentials = Buffer.from(base64Credentials, "base64").toString(
      "utf-8",
    );
    const colonIndex = credentials.indexOf(":");

    if (colonIndex > 0) {
      username = credentials.slice(0, colonIndex);
      password = credentials.slice(colonIndex + 1);
    }
  } else if (authHeader?.startsWith("Bearer ")) {
    // Handle Bearer token (refresh token) authentication
    const bearerToken = authHeader.slice(7);
    console.log(
      `[TokenEndpoint] Bearer token auth, scope=${JSON.stringify(scope)}`,
    );
    const { verifyRegistryToken } = await import("@/lib/registry-token");
    const claims = await verifyRegistryToken(bearerToken);

    if (claims) {
      // Get user to check current permissions
      const user = await db.query.users.findFirst({
        where: eq(schema.users.username, claims.sub),
      });

      if (user) {
        // Parse scopes and generate new access with user's permissions
        const parsedScopes = parseScopes(scope);
        const isAdmin = user.role === "admin";
        const grantedAccess = await generateGrantedAccess(
          parsedScopes,
          claims.sub,
          isAdmin,
        );

        console.log(
          `[TokenEndpoint] Bearer: User "${claims.sub}" isAdmin=${isAdmin} parsedScopes=${JSON.stringify(parsedScopes)} grantedAccess=${JSON.stringify(grantedAccess)}`,
        );

        const tokenResponse = await createRegistryToken(
          claims.sub,
          grantedAccess,
          service,
        );
        return NextResponse.json(tokenResponse);
      }
    }

    console.log("[TokenEndpoint] Bearer token verification failed");
    return NextResponse.json(
      { errors: [{ code: "UNAUTHORIZED", message: "Invalid refresh token" }] },
      { status: 401 },
    );
  }

  // If no credentials and no scope, return anonymous token (for catalog browsing)
  if (!username && scope.length === 0) {
    const tokenResponse = await createRegistryToken("anonymous", [], service);
    return NextResponse.json(tokenResponse);
  }

  // Validate credentials if provided
  if (username && password) {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.username, username),
    });

    if (!user) {
      return NextResponse.json(
        { errors: [{ code: "UNAUTHORIZED", message: "Invalid credentials" }] },
        { status: 401 },
      );
    }

    // Try password authentication first
    let passwordValid = await verifyPassword(password, user.passwordHash);
    let isAccessToken = false;
    let tokenPermissions: string[] = [];

    // If password fails and input looks like an access token, try token authentication
    if (!passwordValid && password.startsWith("ait_")) {
      // Find all access tokens for this user
      const tokens = await db.query.accessTokens.findMany({
        where: eq(schema.accessTokens.userId, user.id),
      });

      // Try to verify against each token hash
      for (const token of tokens) {
        // Check if token is expired
        if (token.expiresAt && token.expiresAt < new Date()) {
          continue;
        }

        const tokenValid = await verifyAccessToken(password, token.tokenHash);
        if (tokenValid) {
          passwordValid = true;
          isAccessToken = true;
          tokenPermissions = token.permissions.split(",");

          // Update last used timestamp
          await db
            .update(schema.accessTokens)
            .set({ lastUsedAt: new Date() })
            .where(eq(schema.accessTokens.id, token.id));
          break;
        }
      }
    }

    if (!passwordValid) {
      return NextResponse.json(
        { errors: [{ code: "UNAUTHORIZED", message: "Invalid credentials" }] },
        { status: 401 },
      );
    }

    // Parse requested scopes and generate granted access
    const parsedScopes = parseScopes(scope);
    const isAdmin = user.role === "admin";

    // If using an access token, filter actions by token permissions
    let grantedAccess: TokenAccess[];
    if (isAccessToken && tokenPermissions.length > 0) {
      const fullAccess = await generateGrantedAccess(
        parsedScopes,
        username,
        isAdmin,
      );
      grantedAccess = fullAccess
        .map((access) => ({
          ...access,
          // Filter actions to only those allowed by the token
          actions: access.actions.filter((action) =>
            action === "*"
              ? tokenPermissions.includes("push") &&
                tokenPermissions.includes("pull") &&
                tokenPermissions.includes("delete")
              : tokenPermissions.includes(action),
          ) as ("push" | "pull" | "delete" | "*")[],
        }))
        .filter((access) => access.actions.length > 0);
    } else {
      grantedAccess = await generateGrantedAccess(
        parsedScopes,
        username,
        isAdmin,
      );
    }

    // Generate token with granted access
    console.log(
      `[TokenEndpoint] User "${username}" isAdmin=${isAdmin} grantedAccess=${JSON.stringify(grantedAccess)}`,
    );
    const tokenResponse = await createRegistryToken(
      username,
      grantedAccess,
      service,
    );

    // Add refresh token if requested (for docker login persistence)
    // Note: Don't provide refresh tokens when using access tokens
    if (offlineToken && !isAccessToken) {
      // Create a proper long-lived refresh token (7 days default)
      const { createRefreshToken } = await import("@/lib/registry-token");
      tokenResponse.refresh_token = await createRefreshToken(username, service);
    }

    return NextResponse.json(tokenResponse);
  }

  // No valid authentication provided
  return NextResponse.json(
    { errors: [{ code: "UNAUTHORIZED", message: "Authentication required" }] },
    { status: 401 },
  );
}

/**
 * POST endpoint for OAuth2 compatibility
 * Some clients may use POST for token requests
 */
export async function POST(request: Request) {
  // For form-encoded requests (OAuth2 style)
  const contentType = request.headers.get("Content-Type");

  console.log(`[TokenEndpoint POST] Content-Type: ${contentType}`);

  if (contentType?.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    const grantType = formData.get("grant_type");
    const refreshToken = formData.get("refresh_token");
    const scope = formData.getAll("scope") as string[];
    const service =
      (formData.get("service") as string) ||
      process.env.REGISTRY_SERVICE_NAME ||
      "aithen-registry";
    const _clientId = formData.get("client_id");

    console.log(
      `[TokenEndpoint POST] grantType=${grantType} hasRefreshToken=${!!refreshToken} scope=${JSON.stringify(scope)} service=${service}`,
    );

    if (grantType === "refresh_token" && refreshToken) {
      // Verify refresh token and issue new access token
      const { verifyRegistryToken } = await import("@/lib/registry-token");
      const claims = await verifyRegistryToken(refreshToken as string);

      if (!claims) {
        console.log("[TokenEndpoint POST] Refresh token verification failed");
        return NextResponse.json(
          {
            errors: [
              { code: "INVALID_GRANT", message: "Invalid refresh token" },
            ],
          },
          { status: 400 },
        );
      }

      // Get user to check current permissions
      const user = await db.query.users.findFirst({
        where: eq(schema.users.username, claims.sub),
      });

      if (!user) {
        return NextResponse.json(
          { errors: [{ code: "INVALID_GRANT", message: "User not found" }] },
          { status: 400 },
        );
      }

      // Parse scopes and generate new access
      const parsedScopes = parseScopes(scope);
      const isAdmin = user.role === "admin";
      const grantedAccess = await generateGrantedAccess(
        parsedScopes,
        claims.sub,
        isAdmin,
      );

      console.log(
        `[TokenEndpoint POST] Refresh: User "${claims.sub}" isAdmin=${isAdmin} grantedAccess=${JSON.stringify(grantedAccess)}`,
      );

      const tokenResponse = await createRegistryToken(
        claims.sub,
        grantedAccess,
        service,
      );
      return NextResponse.json(tokenResponse);
    }

    // Handle password grant type (Docker client uses this for token refresh with stored credentials)
    if (grantType === "password") {
      const username = formData.get("username") as string;
      const password = formData.get("password") as string;

      if (!username || !password) {
        return NextResponse.json(
          {
            errors: [
              { code: "INVALID_REQUEST", message: "Missing username or password" },
            ],
          },
          { status: 400 },
        );
      }

      const user = await db.query.users.findFirst({
        where: eq(schema.users.username, username),
      });

      if (!user) {
        return NextResponse.json(
          { errors: [{ code: "UNAUTHORIZED", message: "Invalid credentials" }] },
          { status: 401 },
        );
      }

      // Try password authentication first
      let passwordValid = await verifyPassword(password, user.passwordHash);
      let isAccessToken = false;
      let tokenPermissions: string[] = [];

      // If password fails and input looks like an access token, try token authentication
      if (!passwordValid && password.startsWith("ait_")) {
        // Find all access tokens for this user
        const tokens = await db.query.accessTokens.findMany({
          where: eq(schema.accessTokens.userId, user.id),
        });

        // Try to verify against each token hash
        for (const token of tokens) {
          // Check if token is expired
          if (token.expiresAt && token.expiresAt < new Date()) {
            continue;
          }

          const tokenValid = await verifyAccessToken(password, token.tokenHash);
          if (tokenValid) {
            passwordValid = true;
            isAccessToken = true;
            tokenPermissions = token.permissions.split(",");

            // Update last used timestamp
            await db
              .update(schema.accessTokens)
              .set({ lastUsedAt: new Date() })
              .where(eq(schema.accessTokens.id, token.id));
            break;
          }
        }
      }

      if (!passwordValid) {
        return NextResponse.json(
          { errors: [{ code: "UNAUTHORIZED", message: "Invalid credentials" }] },
          { status: 401 },
        );
      }

      // Parse scopes and generate access
      const parsedScopes = parseScopes(scope);
      const isAdmin = user.role === "admin";

      // If using an access token, filter actions by token permissions
      let grantedAccess: TokenAccess[];
      if (isAccessToken && tokenPermissions.length > 0) {
        const fullAccess = await generateGrantedAccess(
          parsedScopes,
          username,
          isAdmin,
        );
        grantedAccess = fullAccess
          .map((access) => ({
            ...access,
            // Filter actions to only those allowed by the token
            actions: access.actions.filter((action) =>
              action === "*"
                ? tokenPermissions.includes("push") &&
                  tokenPermissions.includes("pull") &&
                  tokenPermissions.includes("delete")
                : tokenPermissions.includes(action),
            ) as ("push" | "pull" | "delete" | "*")[],
          }))
          .filter((access) => access.actions.length > 0);
      } else {
        grantedAccess = await generateGrantedAccess(
          parsedScopes,
          username,
          isAdmin,
        );
      }

      console.log(
        `[TokenEndpoint POST] Password grant: User "${username}" isAdmin=${isAdmin} isAccessToken=${isAccessToken} grantedAccess=${JSON.stringify(grantedAccess)}`,
      );

      const tokenResponse = await createRegistryToken(
        username,
        grantedAccess,
        service,
      );
      return NextResponse.json(tokenResponse);
    }
  }

  // Fall back to GET behavior for JSON requests
  return GET(request);
}
