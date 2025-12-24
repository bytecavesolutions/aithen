import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { verifyPassword } from "@/lib/auth";
import {
  createRegistryToken,
  generateGrantedAccess,
  parseScopes,
} from "@/lib/registry-token";

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
  const service = url.searchParams.get("service");
  const scope = url.searchParams.getAll("scope");
  const _clientId = url.searchParams.get("client_id");
  const offlineToken = url.searchParams.get("offline_token") === "true";
  const _account = url.searchParams.get("account");

  // Validate required parameters
  if (!service) {
    return NextResponse.json(
      {
        errors: [
          { code: "INVALID_REQUEST", message: "Missing service parameter" },
        ],
      },
      { status: 400 },
    );
  }

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
  }

  // If no credentials and no scope, return anonymous token (for catalog browsing)
  if (!username && scope.length === 0) {
    const tokenResponse = await createRegistryToken("anonymous", []);
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

    const passwordValid = await verifyPassword(password, user.passwordHash);

    if (!passwordValid) {
      return NextResponse.json(
        { errors: [{ code: "UNAUTHORIZED", message: "Invalid credentials" }] },
        { status: 401 },
      );
    }

    // Parse requested scopes and generate granted access
    const parsedScopes = parseScopes(scope);
    const isAdmin = user.role === "admin";
    const grantedAccess = generateGrantedAccess(
      parsedScopes,
      username,
      isAdmin,
    );

    // Generate token with granted access
    const tokenResponse = await createRegistryToken(username, grantedAccess);

    // Add refresh token if requested (for docker login persistence)
    if (offlineToken) {
      // For simplicity, we use the same token as refresh token
      // In production, you might want a separate longer-lived token
      tokenResponse.refresh_token = tokenResponse.token;
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

  if (contentType?.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    const grantType = formData.get("grant_type");
    const refreshToken = formData.get("refresh_token");
    const scope = formData.getAll("scope") as string[];
    const _service = formData.get("service") as string;
    const _clientId = formData.get("client_id");

    if (grantType === "refresh_token" && refreshToken) {
      // Verify refresh token and issue new access token
      const { verifyRegistryToken } = await import("@/lib/registry-token");
      const claims = await verifyRegistryToken(refreshToken as string);

      if (!claims) {
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
      const grantedAccess = generateGrantedAccess(
        parsedScopes,
        claims.sub,
        isAdmin,
      );

      const tokenResponse = await createRegistryToken(
        claims.sub,
        grantedAccess,
      );
      return NextResponse.json(tokenResponse);
    }
  }

  // Fall back to GET behavior for JSON requests
  return GET(request);
}
