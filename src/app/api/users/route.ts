import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { createUserSchema } from "@/lib/validations";

// GET /api/users - List all users (admin only)
export async function GET() {
	try {
		const currentUser = await getCurrentUser();

		if (!currentUser || currentUser.role !== "admin") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const users = await db.query.users.findMany({
			orderBy: (users, { desc }) => [desc(users.createdAt)],
		});

		const safeUsers = users.map(({ passwordHash: _, ...user }) => user);

		return NextResponse.json({ users: safeUsers });
	} catch (error) {
		console.error("Get users error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

// POST /api/users - Create a new user (admin only)
export async function POST(request: Request) {
	try {
		const currentUser = await getCurrentUser();

		if (!currentUser || currentUser.role !== "admin") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const body = await request.json();
		const result = createUserSchema.safeParse(body);

		if (!result.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: result.error.flatten() },
				{ status: 400 },
			);
		}

		const { username, email, password, role } = result.data;

		// Check if username already exists
		const existingUsername = await db.query.users.findFirst({
			where: eq(schema.users.username, username),
		});

		if (existingUsername) {
			return NextResponse.json(
				{ error: "Username already exists" },
				{ status: 409 },
			);
		}

		// Check if email already exists
		const existingEmail = await db.query.users.findFirst({
			where: eq(schema.users.email, email),
		});

		if (existingEmail) {
			return NextResponse.json(
				{ error: "Email already exists" },
				{ status: 409 },
			);
		}

		// Hash password and create user
		const passwordHash = await hashPassword(password);

		const [newUser] = await db
			.insert(schema.users)
			.values({
				username,
				email,
				passwordHash,
				role,
			})
			.returning();

		const { passwordHash: _, ...safeUser } = newUser;

		return NextResponse.json({ user: safeUser }, { status: 201 });
	} catch (error) {
		console.error("Create user error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
