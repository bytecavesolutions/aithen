import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const passkeys = await db.query.passkeys.findMany({
      where: eq(schema.passkeys.userId, user.id),
      orderBy: (passkeys, { desc }) => [desc(passkeys.createdAt)],
    });

    return NextResponse.json({
      passkeys: passkeys.map((p) => ({
        id: p.id,
        deviceName: p.deviceName,
        createdAt: p.createdAt,
        lastUsedAt: p.lastUsedAt,
      })),
    });
  } catch (error) {
    console.error("List passkeys error:", error);
    return NextResponse.json(
      { error: "Failed to list passkeys" },
      { status: 500 },
    );
  }
}
