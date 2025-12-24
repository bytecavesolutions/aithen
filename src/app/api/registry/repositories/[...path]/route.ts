import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getImageManifest, getRepositoryTags } from "@/lib/registry";
import { isUserRepository } from "@/lib/registry-token";

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

/**
 * Get tags and images for a specific repository
 * Path format: /api/registry/repositories/[namespace]/[...name]
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const repository = path.join("/");

  // Check access permissions
  if (user.role !== "admin" && !isUserRepository(repository, user.username)) {
    return NextResponse.json(
      { error: "Access denied to this repository" },
      { status: 403 },
    );
  }

  try {
    const tags = await getRepositoryTags(repository);

    // Get manifest info for each tag
    const images = await Promise.all(
      tags.map(async (tag) => {
        const manifest = await getImageManifest(repository, tag);
        return {
          tag,
          digest: manifest?.digest || null,
          size: manifest?.size || null,
        };
      }),
    );

    return NextResponse.json({
      repository,
      tags,
      images,
      totalImages: images.length,
    });
  } catch (error) {
    console.error("Error fetching repository:", error);
    return NextResponse.json(
      { error: "Failed to fetch repository" },
      { status: 500 },
    );
  }
}
