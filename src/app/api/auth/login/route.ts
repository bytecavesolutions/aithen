import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import {
  createSession,
  createToken,
  setAuthCookie,
  verifyPassword,
} from "@/lib/auth";
import { getLoginMethodsConfig } from "@/lib/login-settings";
import { loginSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    // Check if password login is enabled
    const loginConfig = await getLoginMethodsConfig();
    if (!loginConfig.passwordEnabled) {
      return NextResponse.json(
        { error: "Password login is disabled" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const { username, password } = result.data;

    // Find user by username
    const user = await db.query.users.findFirst({
      where: eq(schema.users.username, username),
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 },
      );
    }

    // Check if user has a password (OIDC-only users won't)
    if (!user.passwordHash) {
      return NextResponse.json(
        {
          error:
            "This account uses SSO. Please sign in with your identity provider.",
        },
        { status: 401 },
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 },
      );
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
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
