// Next.js Instrumentation Hook
// This file runs once when the server starts
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Only run on the server, not during build
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    console.log("[Instrumentation] Initializing server-side services...");

    // Dynamically import to avoid issues during build
    const { startRegistrySyncWorker } = await import("@/lib/registry-sync");

    // Get sync interval from environment variable (default: 1 minute)
    const syncIntervalMs = Number.parseInt(
      process.env.REGISTRY_SYNC_INTERVAL_MS || "60000",
      10,
    );

    // Start the registry sync worker
    startRegistrySyncWorker(syncIntervalMs);

    console.log(
      `[Instrumentation] Registry sync worker started (interval: ${syncIntervalMs}ms)`,
    );
  }
}
