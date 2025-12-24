import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import {
  generateAccessToken,
  getCurrentUser,
  hashAccessToken,
} from "@/lib/auth";
import { createAccessTokenSchema } from "@/lib/validations";

// GET /api/auth/access-tokens - List user's access tokens
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tokens = await db.query.accessTokens.findMany({
      where: eq(schema.accessTokens.userId, currentUser.id),
      orderBy: (tokens, { desc }) => [desc(tokens.createdAt)],
      columns: {
        id: true,
        name: true,
        permissions: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        // Exclude tokenHash for security
      },
    });

    return NextResponse.json({ tokens });
  } catch (error) {
    console.error("Failed to fetch access tokens:", error);
    return NextResponse.json(
      { error: "Failed to fetch access tokens" },
      { status: 500 },
    );
  }
}

// POST /api/auth/access-tokens - Create a new access token
export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = createAccessTokenSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const { name, permissions, expiresInDays } = result.data;

    // Generate a unique token
    const rawToken = generateAccessToken();
    const tokenHash = await hashAccessToken(rawToken);
    const tokenId = crypto.randomUUID();

    // Calculate expiration date if specified
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Insert the token into the database
    await db.insert(schema.accessTokens).values({
      id: tokenId,
      userId: currentUser.id,
      name,
      tokenHash,
      permissions: permissions.join(","),
      expiresAt,
    });

    // Return the raw token - this is the only time it will be shown
    return NextResponse.json(
      {
        token: {
          id: tokenId,
          name,
          rawToken, // Only returned once!
          expiresAt,
          createdAt: new Date(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create access token:", error);
    return NextResponse.json(
      { error: "Failed to create access token" },
      { status: 500 },
    );
  }
}
