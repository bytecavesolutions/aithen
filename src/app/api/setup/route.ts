import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { createSession, createToken, setAuthCookie } from "@/lib/auth";
import { needsSetup } from "@/lib/setup";

const setupSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be at most 50 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores, and hyphens",
    ),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be at most 100 characters"),
});

export async function POST(request: Request) {
  try {
    // Check if setup is still needed
    const setupNeeded = await needsSetup();

    if (!setupNeeded) {
      return NextResponse.json(
        { error: "Setup already completed" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const result = setupSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const { username, email, password } = result.data;

    // Check if username or email already exists
    try {
      const existingUser = await db.query.users.findFirst({
        where: (users, { or, eq }) =>
          or(eq(users.username, username), eq(users.email, email)),
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "Username or email already exists" },
          { status: 400 },
        );
      }
    } catch (error) {
      // If table doesn't exist, that's okay - we'll create the user anyway
      if (
        !(error instanceof Error && error.message.includes("no such table"))
      ) {
        throw error;
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create admin user
    const [newUser] = await db
      .insert(schema.users)
      .values({
        username,
        email,
        passwordHash,
        role: "admin",
      })
      .returning();

    console.log("✅ Created initial admin user:", username);
    // Auto-create default namespace with username
    try {
      await db.insert(schema.namespaces).values({
        name: username,
        userId: newUser.id,
        description: `Default namespace for ${username}`,
        isDefault: true,
      });
      console.log("✅ Created default namespace:", username);
    } catch (namespaceError) {
      console.error("Failed to create default namespace:", namespaceError);
      // Continue even if namespace creation fails - user is still created
    }
    // Automatically log in the new admin user
    const sessionId = await createSession(newUser.id);

    const token = await createToken({
      userId: newUser.id,
      username: newUser.username,
      role: newUser.role as "admin" | "user",
      sessionId,
    });

    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("Setup error:", error);

    // Provide more helpful error messages
    if (error instanceof Error) {
      if (error.message.includes("no such table")) {
        return NextResponse.json(
          {
            error: "Database tables not found. Please run migrations first.",
            hint: "Run: bun run db:migrate",
          },
          { status: 500 },
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
