import { NextResponse } from "next/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { getCurrentUser } from "@/lib/auth";
import { verifyRegistration } from "@/lib/passkey";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as RegistrationResponseJSON;

    const verified = await verifyRegistration(user.id, body);

    if (!verified.verified) {
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      verified: verified.verified,
    });
  } catch (error) {
    console.error("Passkey registration verification error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to verify registration",
      },
      { status: 500 },
    );
  }
}
