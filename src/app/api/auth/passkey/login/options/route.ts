import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getLoginMethodsConfig } from "@/lib/login-settings";
import { generateAuthenticationOpts } from "@/lib/passkey";

export async function POST(_request: Request) {
  console.log("🔐 Passkey login options requested");

  try {
    // Check if passkey login is enabled
    const loginConfig = await getLoginMethodsConfig();
    if (!loginConfig.passkeyEnabled) {
      return NextResponse.json(
        {
          error: "Passkey login is disabled",
          details:
            "Passkey authentication has been disabled by the administrator",
        },
        { status: 403 },
      );
    }

    // No username needed - using discoverable credentials
    console.log("Generating authentication options...");
    const options = await generateAuthenticationOpts();
    console.log("✅ Options generated:", {
      challenge: `${options.challenge.substring(0, 20)}...`,
    });

    // Store the challenge in a cookie for verification
    const cookieStore = await cookies();
    cookieStore.set("passkey-challenge", options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 5, // 5 minutes
      path: "/",
    });

    console.log("✅ Challenge stored in cookie");
    return NextResponse.json(options);
  } catch (error) {
    console.error("❌ Passkey authentication options error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "");
    return NextResponse.json(
      {
        error: "Failed to generate authentication options",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
