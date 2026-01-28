import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { discoverOIDCEndpoints } from "@/lib/oidc";

/**
 * POST /api/admin/settings/oidc/test
 * Test OIDC discovery endpoint (admin only)
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { issuerUrl } = body;

    if (!issuerUrl) {
      return NextResponse.json(
        { error: "Issuer URL is required" },
        { status: 400 },
      );
    }

    // Try to discover OIDC endpoints
    const endpoints = await discoverOIDCEndpoints(issuerUrl);

    return NextResponse.json({
      success: true,
      endpoints: {
        authorization_endpoint: endpoints.authorization_endpoint,
        token_endpoint: endpoints.token_endpoint,
        userinfo_endpoint: endpoints.userinfo_endpoint,
        jwks_uri: endpoints.jwks_uri,
        issuer: endpoints.issuer,
      },
    });
  } catch (error) {
    console.error("Error testing OIDC discovery:", error);
    return NextResponse.json(
      {
        error: "Discovery failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
