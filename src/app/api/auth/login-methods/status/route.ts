import { NextResponse } from "next/server";
import { getLoginMethodsStatus } from "@/lib/login-settings";

export async function GET() {
  try {
    const status = await getLoginMethodsStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("Error fetching login methods status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
