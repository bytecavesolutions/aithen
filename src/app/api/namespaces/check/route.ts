import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { checkNamespaceSchema } from "@/lib/validations";

// GET /api/namespaces/check?name=<namespace> - Check if namespace is available
export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    const result = checkNamespaceSchema.safeParse({ name });

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 },
      );
    }

    // Check if namespace exists
    const existingNamespace = await db.query.namespaces.findFirst({
      where: eq(schema.namespaces.name, result.data.name),
    });

    return NextResponse.json({
      available: !existingNamespace,
      exists: !!existingNamespace,
    });
  } catch (error) {
    console.error("Check namespace error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
