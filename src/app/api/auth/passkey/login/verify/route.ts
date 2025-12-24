import { NextResponse } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { verifyAuthentication } from "@/lib/passkey";
import { createSession, createToken, setAuthCookie } from "@/lib/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AuthenticationResponseJSON;

    // Get the challenge from cookie
    const cookieStore = await cookies();
    const challenge = cookieStore.get("passkey-challenge")?.value;

    if (!challenge) {
      return NextResponse.json(
        { error: "No challenge found" },
        { status: 400 },
      );
    }

    const { verified, userId } = await verifyAuthentication(body, challenge);

    if (!verified || !userId) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 },
      );
    }

    // Get user details
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create session
    const sessionId = await createSession(user.id);

    // Create JWT token
    const token = await createToken({
      userId: user.id,
      username: user.username,
      role: user.role as "admin" | "user",
      sessionId,
    });

    // Set auth cookie
    await setAuthCookie(token);

    // Clear the challenge cookie
    cookieStore.delete("passkey-challenge");

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Passkey authentication verification error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to verify authentication",
      },
      { status: 500 },
    );
  }
}
