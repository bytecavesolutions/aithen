import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { createNamespaceSchema } from "@/lib/validations";

// GET /api/namespaces - List namespaces
export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin can see all namespaces, regular users only see their own
    const namespaces =
      currentUser.role === "admin"
        ? await db.query.namespaces.findMany({
            orderBy: (namespaces, { desc }) => [desc(namespaces.createdAt)],
            with: {
              user: {
                columns: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
            },
          })
        : await db.query.namespaces.findMany({
            where: eq(schema.namespaces.userId, currentUser.id),
            orderBy: (namespaces, { desc }) => [desc(namespaces.createdAt)],
          });

    return NextResponse.json({ namespaces });
  } catch (error) {
    console.error("Get namespaces error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/namespaces - Create a new namespace (admin only)
export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const result = createNamespaceSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const { name, userId, description } = result.data;

    // Check if namespace already exists
    const existingNamespace = await db.query.namespaces.findFirst({
      where: eq(schema.namespaces.name, name),
    });

    if (existingNamespace) {
      return NextResponse.json(
        { error: "Namespace already exists" },
        { status: 409 },
      );
    }

    // Verify user exists
    const targetUser = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create namespace
    const [newNamespace] = await db
      .insert(schema.namespaces)
      .values({
        name,
        userId,
        description,
        isDefault: false,
      })
      .returning();

    return NextResponse.json({ namespace: newNamespace }, { status: 201 });
  } catch (error) {
    console.error("Create namespace error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
