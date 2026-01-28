import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  cleanupExpiredStates,
  createOAuthState,
  generateAuthorizationUrl,
  getOIDCConfig,
} from "@/lib/oidc";

/**
 * GET /api/auth/oidc/authorize
 * Initiate OIDC login flow (redirect to provider)
 */
export async function GET(request: Request) {
  try {
    // Clean up expired states
    await cleanupExpiredStates();

    const config = await getOIDCConfig();

    if (!config || !config.enabled) {
      return NextResponse.json(
        { error: "OIDC authentication is not enabled" },
        { status: 400 },
      );
    }

    // Get the callback URL from the request headers
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = headersList.get("x-forwarded-proto") || "http";

    // Check for redirect_uri in query params
    const url = new URL(request.url);
    const redirectUri = url.searchParams.get("redirect_uri") ?? undefined;

    const callbackUrl = `${protocol}://${host}/api/auth/oidc/callback`;

    // Create OAuth state with PKCE
    const { state, codeVerifier } = await createOAuthState(redirectUri);

    // Generate authorization URL
    const authUrl = await generateAuthorizationUrl(
      config,
      state,
      codeVerifier,
      callbackUrl,
    );

    // Redirect to the OIDC provider
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Error initiating OIDC flow:", error);
    return NextResponse.json(
      { error: "Failed to initiate OIDC authentication" },
      { status: 500 },
    );
  }
}
