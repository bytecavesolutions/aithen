import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getLoginMethodsConfig,
  getLoginMethodsStatus,
  saveLoginMethodsConfig,
} from "@/lib/login-settings";
import { loginMethodsSettingsSchema } from "@/lib/validations";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const config = await getLoginMethodsConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching login methods config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const result = loginMethodsSettingsSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const { passwordEnabled, passkeyEnabled, autoTrigger } = result.data;
    const { oidcEnabled } = await getLoginMethodsStatus();

    // Check that at least one login method will remain enabled
    if (!passwordEnabled && !passkeyEnabled && !oidcEnabled) {
      return NextResponse.json(
        {
          error:
            "At least one login method must be enabled. Enable OIDC/SSO first if you want to disable password and passkey login.",
        },
        { status: 400 },
      );
    }

    // Validate autoTrigger setting
    if (autoTrigger === "passkey" && !passkeyEnabled) {
      return NextResponse.json(
        {
          error:
            "Cannot set auto-trigger to passkey when passkey login is disabled",
        },
        { status: 400 },
      );
    }

    if (autoTrigger === "oidc" && !oidcEnabled) {
      return NextResponse.json(
        {
          error:
            "Cannot set auto-trigger to OIDC when OIDC/SSO is not enabled. Configure OIDC first.",
        },
        { status: 400 },
      );
    }

    await saveLoginMethodsConfig(result.data);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving login methods config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
