import { NextResponse } from "next/server";
import { getSession, deleteSession, clearAuthCookie } from "@/lib/auth";

export async function POST() {
	try {
		const session = await getSession();

		if (session) {
			await deleteSession(session.sessionId);
		}

		await clearAuthCookie();

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Logout error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
