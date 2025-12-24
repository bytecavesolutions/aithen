import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { deleteAccessTokenSchema } from "@/lib/validations";

// DELETE /api/auth/access-tokens/delete - Delete an access token
export async function DELETE(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = deleteAccessTokenSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const { tokenId } = result.data;

    // Verify the token belongs to the current user
    const token = await db.query.accessTokens.findFirst({
      where: eq(schema.accessTokens.id, tokenId),
    });

    if (!token) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    if (token.userId !== currentUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete the token
    await db
      .delete(schema.accessTokens)
      .where(
        and(
          eq(schema.accessTokens.id, tokenId),
          eq(schema.accessTokens.userId, currentUser.id),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete access token:", error);
    return NextResponse.json(
      { error: "Failed to delete access token" },
      { status: 500 },
    );
  }
}
