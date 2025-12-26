import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { updateNamespaceSchema } from "@/lib/validations";

// GET /api/namespaces/[id] - Get a specific namespace
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const namespaceId = Number.parseInt(id, 10);

    if (Number.isNaN(namespaceId)) {
      return NextResponse.json(
        { error: "Invalid namespace ID" },
        { status: 400 },
      );
    }

    const namespace = await db.query.namespaces.findFirst({
      where: eq(schema.namespaces.id, namespaceId),
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!namespace) {
      return NextResponse.json(
        { error: "Namespace not found" },
        { status: 404 },
      );
    }

    // Regular users can only see their own namespaces
    if (currentUser.role !== "admin" && namespace.userId !== currentUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ namespace });
  } catch (error) {
    console.error("Get namespace error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH /api/namespaces/[id] - Update a namespace
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const namespaceId = Number.parseInt(id, 10);

    if (Number.isNaN(namespaceId)) {
      return NextResponse.json(
        { error: "Invalid namespace ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const result = updateNamespaceSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 },
      );
    }

    // Check if namespace exists
    const namespace = await db.query.namespaces.findFirst({
      where: eq(schema.namespaces.id, namespaceId),
    });

    if (!namespace) {
      return NextResponse.json(
        { error: "Namespace not found" },
        { status: 404 },
      );
    }

    // Update namespace
    const [updatedNamespace] = await db
      .update(schema.namespaces)
      .set({
        ...result.data,
        updatedAt: new Date(),
      })
      .where(eq(schema.namespaces.id, namespaceId))
      .returning();

    return NextResponse.json({ namespace: updatedNamespace });
  } catch (error) {
    console.error("Update namespace error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/namespaces/[id] - Delete a namespace
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const namespaceId = Number.parseInt(id, 10);

    if (Number.isNaN(namespaceId)) {
      return NextResponse.json(
        { error: "Invalid namespace ID" },
        { status: 400 },
      );
    }

    // Check if namespace exists
    const namespace = await db.query.namespaces.findFirst({
      where: eq(schema.namespaces.id, namespaceId),
    });

    if (!namespace) {
      return NextResponse.json(
        { error: "Namespace not found" },
        { status: 404 },
      );
    }

    // Prevent deletion of default namespace
    if (namespace.isDefault) {
      return NextResponse.json(
        {
          error:
            "Cannot delete default namespace. Delete the user instead to remove their default namespace.",
        },
        { status: 400 },
      );
    }

    // Delete namespace
    await db
      .delete(schema.namespaces)
      .where(eq(schema.namespaces.id, namespaceId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete namespace error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
