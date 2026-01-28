import { NextResponse } from "next/server";
import { getOIDCConfig } from "@/lib/oidc";

/**
 * GET /api/auth/oidc/status
 * Check if OIDC is enabled (public endpoint for login page)
 */
export async function GET() {
  try {
    const config = await getOIDCConfig();

    return NextResponse.json({
      enabled: config?.enabled ?? false,
    });
  } catch (error) {
    console.error("Error checking OIDC status:", error);
    return NextResponse.json({
      enabled: false,
    });
  }
}
