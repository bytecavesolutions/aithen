import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getOIDCConfig, saveOIDCConfig } from "@/lib/oidc";
import { oidcSettingsSchema } from "@/lib/validations";

/**
 * GET /api/admin/settings/oidc
 * Get OIDC configuration (admin only)
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const config = await getOIDCConfig();

    if (!config) {
      // Return default config structure
      return NextResponse.json({
        enabled: false,
        issuerUrl: "",
        clientId: "",
        clientSecret: "",
        usernameClaim: "preferred_username",
        autoCreateUsers: false,
        defaultRole: "user",
      });
    }

    // Mask the client secret for security
    return NextResponse.json({
      ...config,
      clientSecret: config.clientSecret ? "********" : "",
    });
  } catch (error) {
    console.error("Error fetching OIDC config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/settings/oidc
 * Update OIDC configuration (admin only)
 */
export async function PUT(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // If client secret is masked, preserve the existing one
    let clientSecret = body.clientSecret;
    if (clientSecret === "********") {
      const existingConfig = await getOIDCConfig();
      if (existingConfig) {
        clientSecret = existingConfig.clientSecret;
      } else {
        return NextResponse.json(
          { error: "Client secret is required" },
          { status: 400 },
        );
      }
    }

    const dataToValidate = {
      ...body,
      clientSecret,
    };

    // Validate input
    const result = oidcSettingsSchema.safeParse(dataToValidate);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 },
      );
    }

    await saveOIDCConfig(result.data);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving OIDC config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
