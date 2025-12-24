import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { passkeyId } = await request.json();

    if (!passkeyId) {
      return NextResponse.json(
        { error: "Passkey ID is required" },
        { status: 400 },
      );
    }

    // Verify the passkey belongs to the user
    const passkey = await db.query.passkeys.findFirst({
      where: eq(schema.passkeys.id, passkeyId),
    });

    if (!passkey || passkey.userId !== user.id) {
      return NextResponse.json({ error: "Passkey not found" }, { status: 404 });
    }

    await db.delete(schema.passkeys).where(eq(schema.passkeys.id, passkeyId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete passkey error:", error);
    return NextResponse.json(
      { error: "Failed to delete passkey" },
      { status: 500 },
    );
  }
}
