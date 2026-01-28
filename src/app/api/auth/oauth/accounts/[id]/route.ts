import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getSession } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/auth/oauth/accounts/[id]
 * Unlink an OAuth account from the current user
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Find the account
    const account = await db.query.oauthAccounts.findFirst({
      where: and(
        eq(schema.oauthAccounts.id, id),
        eq(schema.oauthAccounts.userId, session.userId),
      ),
    });

    if (!account) {
      return NextResponse.json(
        { error: "OAuth account not found" },
        { status: 404 },
      );
    }

    // Check if user has a password set
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, session.userId),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Count total OAuth accounts and passkeys
    const oauthAccounts = await db.query.oauthAccounts.findMany({
      where: eq(schema.oauthAccounts.userId, session.userId),
    });

    const passkeys = await db.query.passkeys.findMany({
      where: eq(schema.passkeys.userId, session.userId),
    });

    const hasPassword = !!user.passwordHash;
    const hasOtherOAuth = oauthAccounts.length > 1;
    const hasPasskeys = passkeys.length > 0;

    // Prevent unlinking if it would leave the user without any auth method
    if (!hasPassword && !hasOtherOAuth && !hasPasskeys) {
      return NextResponse.json(
        {
          error:
            "Cannot unlink the only authentication method. Please set a password or add a passkey first.",
        },
        { status: 400 },
      );
    }

    // Delete the OAuth account
    await db
      .delete(schema.oauthAccounts)
      .where(eq(schema.oauthAccounts.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unlinking OAuth account:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
