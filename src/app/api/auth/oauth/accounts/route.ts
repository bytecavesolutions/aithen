import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getSession } from "@/lib/auth";

/**
 * GET /api/auth/oauth/accounts
 * List linked OAuth accounts for the current user
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accounts = await db.query.oauthAccounts.findMany({
      where: eq(schema.oauthAccounts.userId, session.userId),
    });

    return NextResponse.json({
      accounts: accounts.map((account) => ({
        id: account.id,
        provider: account.provider,
        providerUsername: account.providerUsername,
        email: account.email,
        name: account.name,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching OAuth accounts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
