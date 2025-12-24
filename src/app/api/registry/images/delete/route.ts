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

    console.log(`[DELETE /api/registry/images/delete] Request to delete ${repository}:${tag}`);
    console.log(`[DELETE /api/registry/images/delete] User: ${user.username}, Role: ${user.role}`);

    // Check access permissions
    if (user.role !== "admin" && !isUserRepository(repository, user.username)) {
      console.error(`[DELETE /api/registry/images/delete] Access denied for user ${user.username} to ${repository}`);
      return NextResponse.json(
        { error: "Access denied to this repository" },
        { status: 403 },
      );
    }

    // First, verify the repository and tag exist
    const { getRepositoryTags } = await import("@/lib/registry");
    const existingTags = await getRepositoryTags(repository);
    
    console.log(`[DELETE /api/registry/images/delete] Existing tags for ${repository}:`, existingTags);
    
    if (!existingTags.includes(tag)) {
      console.error(`[DELETE /api/registry/images/delete] Tag '${tag}' not found in repository '${repository}'`);
      console.error(`[DELETE /api/registry/images/delete] Available tags:`, existingTags);
      return NextResponse.json(
        { 
          error: `Image tag '${tag}' not found in repository '${repository}'`,
          availableTags: existingTags
        },
        { status: 404 },
      );
    }

    // Get the manifest to obtain the digest
    console.log(`[DELETE /api/registry/images/delete] Fetching manifest for ${repository}:${tag}`);
    const manifest = await getImageManifest(repository, tag);

    if (!manifest || !manifest.digest) {
      console.warn(`[DELETE /api/registry/images/delete] Manifest not found for ${repository}:${tag} - image may be in inconsistent state`);
      
      // If manifest doesn't exist but tag is listed, the registry is in an inconsistent state
      // We should try to delete by tag reference directly
      console.log(`[DELETE /api/registry/images/delete] Attempting direct delete by tag reference`);
      const directDeleteSuccess = await deleteImage(repository, tag);
      
      if (directDeleteSuccess) {
        console.log(`[DELETE /api/registry/images/delete] Successfully deleted ${repository}:${tag} by tag reference`);
        return NextResponse.json({
          success: true,
          message: `Deleted ${repository}:${tag} (recovered from inconsistent state)`,
        });
      }
      
      console.error(`[DELETE /api/registry/images/delete] Failed to delete ${repository}:${tag} - both digest and tag delete failed`);
      return NextResponse.json(
        { error: `Failed to delete ${repository}:${tag}. The image appears to be in an inconsistent state. Try running registry garbage collection.` },
        { status: 500 },
      );
    }

    console.log(`[DELETE /api/registry/images/delete] Got manifest digest: ${manifest.digest}`);

    // Delete by digest (required for registry v2 API)
    const success = await deleteImage(repository, manifest.digest);

    if (!success) {
      console.error(`[DELETE /api/registry/images/delete] Failed to delete image ${repository}:${tag}`);
      return NextResponse.json(
        { error: "Failed to delete image" },
        { status: 500 },
      );
    }

    console.log(`[DELETE /api/registry/images/delete] Successfully deleted ${repository}:${tag}`);

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
