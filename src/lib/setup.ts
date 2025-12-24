import { db, schema } from "@/db";

/**
 * Check if the application needs initial setup (no admin user exists)
 */
export async function needsSetup(): Promise<boolean> {
  try {
    const adminUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.role, "admin"),
    });

    return !adminUser;
  } catch (error) {
    // If there's an error (e.g., table doesn't exist), we need setup
    // This is expected on first run before migrations
    if (error instanceof Error && error.message.includes("no such table")) {
      return true;
    }
    console.error("Error checking setup status:", error);
    return true;
  }
}
