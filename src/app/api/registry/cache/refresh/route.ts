import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { triggerImmediateSync } from "@/lib/registry-sync";

export async function POST() {
	const user = await getCurrentUser();

	if (!user || user.role !== "admin") {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		await triggerImmediateSync();
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to refresh cache:", error);
		return NextResponse.json(
			{ error: "Failed to refresh cache" },
			{ status: 500 },
		);
	}
}
