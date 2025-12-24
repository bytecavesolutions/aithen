import { NextResponse } from "next/server";
import { getJWKS } from "@/lib/registry-token";

/**
 * JWKS (JSON Web Key Set) Endpoint for Docker Registry v3
 * 
 * The registry uses this endpoint to dynamically fetch the public key
 * for verifying JWT tokens. This is the modern approach compared to
 * static rootcertbundle configuration.
 * 
 * Endpoint: GET /api/registry/jwks (or /auth/jwks in registry config)
 */
export async function GET() {
  try {
    const jwks = await getJWKS();
    
    return NextResponse.json(jwks, {
      headers: {
        // Cache the JWKS for 1 hour but allow revalidation
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[JWKS] Error generating JWKS:", error);
    return NextResponse.json(
      { error: "Failed to generate JWKS" },
      { status: 500 },
    );
  }
}
