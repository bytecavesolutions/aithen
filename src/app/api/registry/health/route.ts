import { NextResponse } from "next/server";
import { checkRegistryHealth, getCatalog } from "@/lib/registry";

/**
 * Health check endpoint for the registry
 */
export async function GET() {
  try {
    const isHealthy = await checkRegistryHealth();

    if (!isHealthy) {
      return NextResponse.json(
        {
          status: "unhealthy",
          message: "Cannot connect to Docker registry",
          registryUrl: process.env.REGISTRY_URL || "http://localhost:5000",
        },
        { status: 503 },
      );
    }

    // Try to get catalog to verify full functionality
    const repositories = await getCatalog();

    return NextResponse.json({
      status: "healthy",
      registryUrl: process.env.REGISTRY_URL || "http://localhost:5000",
      repositoryCount: repositories.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
