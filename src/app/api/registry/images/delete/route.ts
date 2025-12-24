import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { deleteImage, getImageManifest } from "@/lib/registry";
import { isUserRepository } from "@/lib/registry-token";

const deleteImageSchema = z.object({
  repository: z.string().min(1, "Repository is required"),
  tag: z.string().min(1, "Tag is required"),
});

/**
 * Delete an image from the registry
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = deleteImageSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const { repository, tag } = result.data;

    // Check access permissions
    if (user.role !== "admin" && !isUserRepository(repository, user.username)) {
      return NextResponse.json(
        { error: "Access denied to this repository" },
        { status: 403 },
      );
    }

    // Get the manifest to obtain the digest
    const manifest = await getImageManifest(repository, tag);

    if (!manifest) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Delete by digest (required for registry v2 API)
    const success = await deleteImage(repository, manifest.digest);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to delete image" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${repository}:${tag}`,
    });
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 },
    );
  }
}
