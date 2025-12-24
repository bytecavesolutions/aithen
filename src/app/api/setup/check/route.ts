import { NextResponse } from "next/server";
import { needsSetup } from "@/lib/setup";

export async function GET() {
  try {
    const setupNeeded = await needsSetup();

    return NextResponse.json({
      needsSetup: setupNeeded,
    });
  } catch (error) {
    console.error("Setup check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
