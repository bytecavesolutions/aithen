import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { updateUserSchema } from "@/lib/validations";

// GET /api/users/[id] - Get a single user (admin only)
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const currentUser = await getCurrentUser();

		if (!currentUser || currentUser.role !== "admin") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { id } = await params;
		const userId = Number.parseInt(id, 10);

		if (Number.isNaN(userId)) {
			return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
		}

		const user = await db.query.users.findFirst({
			where: eq(schema.users.id, userId),
		});

		if (!user) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		const { passwordHash: _, ...safeUser } = user;

		return NextResponse.json({ user: safeUser });
	} catch (error) {
		console.error("Get user error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

// PATCH /api/users/[id] - Update a user (admin only)
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const currentUser = await getCurrentUser();

		if (!currentUser || currentUser.role !== "admin") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { id } = await params;
		const userId = Number.parseInt(id, 10);

		if (Number.isNaN(userId)) {
			return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
		}

		const body = await request.json();
		const result = updateUserSchema.safeParse(body);

		if (!result.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: result.error.flatten() },
				{ status: 400 },
			);
		}

		const { username, email, password, role } = result.data;

		// Check if user exists
		const existingUser = await db.query.users.findFirst({
			where: eq(schema.users.id, userId),
		});

		if (!existingUser) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		// Check for username conflict
		if (username && username !== existingUser.username) {
			const usernameExists = await db.query.users.findFirst({
				where: eq(schema.users.username, username),
			});

			if (usernameExists) {
				return NextResponse.json(
					{ error: "Username already exists" },
					{ status: 409 },
				);
			}
		}

		// Check for email conflict
		if (email && email !== existingUser.email) {
			const emailExists = await db.query.users.findFirst({
				where: eq(schema.users.email, email),
			});

			if (emailExists) {
				return NextResponse.json(
					{ error: "Email already exists" },
					{ status: 409 },
				);
			}
		}

		// Prepare update data
		const updateData: Partial<typeof schema.users.$inferInsert> = {
			updatedAt: new Date(),
		};

		if (username) updateData.username = username;
		if (email) updateData.email = email;
		if (role) updateData.role = role;
		if (password) updateData.passwordHash = await hashPassword(password);

		const [updatedUser] = await db
			.update(schema.users)
			.set(updateData)
			.where(eq(schema.users.id, userId))
			.returning();

		const { passwordHash: _, ...safeUser } = updatedUser;

		return NextResponse.json({ user: safeUser });
	} catch (error) {
		console.error("Update user error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

// DELETE /api/users/[id] - Delete a user (admin only)
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const currentUser = await getCurrentUser();

		if (!currentUser || currentUser.role !== "admin") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { id } = await params;
		const userId = Number.parseInt(id, 10);

		if (Number.isNaN(userId)) {
			return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
		}

		// Prevent self-deletion
		if (userId === currentUser.id) {
			return NextResponse.json(
				{ error: "Cannot delete your own account" },
				{ status: 400 },
			);
		}

		// Check if user exists
		const existingUser = await db.query.users.findFirst({
			where: eq(schema.users.id, userId),
		});

		if (!existingUser) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		await db.delete(schema.users).where(eq(schema.users.id, userId));

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Delete user error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
