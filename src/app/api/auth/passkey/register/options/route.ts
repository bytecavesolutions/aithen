import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateRegistrationOpts } from "@/lib/passkey";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const options = await generateRegistrationOpts(user.id);

    return NextResponse.json(options);
  } catch (error) {
    console.error("Passkey registration options error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to generate registration options",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
