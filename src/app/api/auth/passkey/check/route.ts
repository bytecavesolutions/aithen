import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 },
      );
    }

    // Find user by username
    const user = await db.query.users.findFirst({
      where: eq(schema.users.username, username),
    });

    if (!user) {
      return NextResponse.json({ hasPasskey: false });
    }

    // Check if user has any passkeys
    const passkeys = await db.query.passkeys.findMany({
      where: eq(schema.passkeys.userId, user.id),
    });

    return NextResponse.json({
      hasPasskey: passkeys.length > 0,
      passkeyCount: passkeys.length,
    });
  } catch (error) {
    console.error("Passkey check error:", error);
    return NextResponse.json(
      { error: "Failed to check passkey" },
      { status: 500 },
    );
  }
}
