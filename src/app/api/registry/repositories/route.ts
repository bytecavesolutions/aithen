import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  checkRegistryHealth,
  getAllRepositoriesGrouped,
  getCatalog,
  getUserRepositories,
} from "@/lib/registry";

/**
 * Get repositories for the current user
 * - Regular users: see only their own repositories (namespace matches username)
 * - Admins: see all repositories grouped by user
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check registry health first
  const isHealthy = await checkRegistryHealth();

  if (!isHealthy) {
    return NextResponse.json(
      {
        error: "Registry unavailable",
        message:
          "Cannot connect to the Docker registry. Please ensure it is running.",
      },
      { status: 503 },
    );
  }

  try {
    if (user.role === "admin") {
      // Admin view: all repositories grouped by namespace
      const grouped = await getAllRepositoriesGrouped();

      // Convert Map to object for JSON serialization
      const repositories: Record<
        string,
        {
          name: string;
          namespace: string;
          fullName: string;
          tags: string[];
          imageCount: number;
        }[]
      > = {};

      for (const [namespace, repos] of grouped) {
        repositories[namespace] = repos;
      }

      // Get total counts
      const allRepos = await getCatalog();
      const totalImages = Object.values(repositories).reduce(
        (sum, repos) => sum + repos.reduce((s, r) => s + r.imageCount, 0),
        0,
      );

      return NextResponse.json({
        repositories,
        totalRepositories: allRepos.length,
        totalImages,
        isAdmin: true,
      });
    }

    // Regular user view: only their repositories
    const repositories = await getUserRepositories(user.id);
    const totalImages = repositories.reduce((sum, r) => sum + r.imageCount, 0);

    return NextResponse.json({
      repositories,
      totalRepositories: repositories.length,
      totalImages,
      isAdmin: false,
    });
  } catch (error) {
    console.error("Error fetching repositories:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 },
    );
  }
}
