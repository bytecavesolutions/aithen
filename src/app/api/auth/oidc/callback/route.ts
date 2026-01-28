import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  completeOIDCLogin,
  exchangeCodeForTokens,
  findOrCreateOIDCUser,
  getOIDCConfig,
  getUserInfoFromToken,
  verifyIdToken,
  verifyOAuthState,
} from "@/lib/oidc";

/**
 * GET /api/auth/oidc/callback
 * Handle OIDC provider callback
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    // Get base URL for redirects
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = headersList.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;

    // Helper function to redirect with error
    const redirectWithError = (errorMessage: string) => {
      const loginUrl = new URL("/login", baseUrl);
      loginUrl.searchParams.set("error", errorMessage);
      return NextResponse.redirect(loginUrl.toString());
    };

    // Check for error from provider
    if (error) {
      console.error("OIDC provider error:", error, errorDescription);
      return redirectWithError(errorDescription || error);
    }

    // Validate required parameters
    if (!code || !state) {
      return redirectWithError("Missing authorization code or state");
    }

    // Get OIDC config
    const config = await getOIDCConfig();
    if (!config || !config.enabled) {
      return redirectWithError("OIDC authentication is not enabled");
    }

    // Verify state and get code verifier
    const stateData = await verifyOAuthState(state);
    if (!stateData) {
      return redirectWithError("Invalid or expired state. Please try again.");
    }

    // Build callback URL
    const callbackUrl = `${baseUrl}/api/auth/oidc/callback`;

    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForTokens(
      config,
      code,
      stateData.codeVerifier,
      callbackUrl,
    ).catch((err) => {
      console.error("Token exchange error:", err);
      return null;
    });
    if (!tokenResponse) {
      return redirectWithError("Failed to exchange authorization code");
    }

    // Verify ID token
    const claims = await verifyIdToken(tokenResponse.id_token, config).catch(
      (err) => {
        console.error("ID token verification error:", err);
        return null;
      },
    );
    if (!claims) {
      return redirectWithError("Failed to verify identity");
    }

    // Extract user info
    let userInfo: {
      username: string;
      email?: string;
      name?: string;
      sub: string;
    };
    try {
      userInfo = getUserInfoFromToken(claims, config.usernameClaim);
    } catch (err) {
      console.error("User info extraction error:", err);
      return redirectWithError(
        err instanceof Error
          ? err.message
          : "Failed to extract user information",
      );
    }

    // Find or create user
    const userResult = await findOrCreateOIDCUser(userInfo, config).catch(
      (err) => {
        console.error("User lookup/creation error:", err);
        return null;
      },
    );
    if (!userResult) {
      return redirectWithError("Failed to authenticate user");
    }
    const { user } = userResult;

    // Complete login
    await completeOIDCLogin(user);

    // Redirect to dashboard or original destination
    const redirectUrl = stateData.redirectUri || "/dashboard";
    return NextResponse.redirect(new URL(redirectUrl, baseUrl).toString());
  } catch (error) {
    console.error("OIDC callback error:", error);

    // Get base URL for error redirect
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = headersList.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;

    const loginUrl = new URL("/login", baseUrl);
    loginUrl.searchParams.set(
      "error",
      "Authentication failed. Please try again.",
    );
    return NextResponse.redirect(loginUrl.toString());
  }
}
