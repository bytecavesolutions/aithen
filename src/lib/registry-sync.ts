import {
  checkRegistryHealth,
  getAllRepositoriesGrouped,
  type getUserRepositories,
} from "./registry";
import {
  acquireSyncLock,
  type CachedRepositories,
  type CachedUserRepositories,
  cleanupExpiredCache,
  extendSyncLock,
  releaseSyncLock,
  setCachedData,
} from "./registry-cache";

// Default sync interval: 2 minutes
const DEFAULT_SYNC_INTERVAL_MS = 2 * 60 * 1000;

// Cache TTL: 5 minutes (longer than sync interval to ensure overlap)
const CACHE_TTL_SECONDS = 5 * 60;

// Generate unique worker ID
const WORKER_ID = `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/**
 * Perform a full sync of registry data to cache
 */
async function performSync(): Promise<void> {
  if (isRunning) {
    console.log("[RegistrySync] Sync already in progress, skipping...");
    return;
  }

  // Try to acquire lock
  const lockAcquired = await acquireSyncLock(WORKER_ID);
  if (!lockAcquired) {
    console.log("[RegistrySync] Another worker is syncing, skipping...");
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    console.log("[RegistrySync] Starting registry sync...");

    // Check if registry is healthy first
    const isHealthy = await checkRegistryHealth();
    if (!isHealthy) {
      console.log("[RegistrySync] Registry is not healthy, skipping sync");
      return;
    }

    // Extend lock periodically during long sync operations
    const lockExtender = setInterval(async () => {
      await extendSyncLock(WORKER_ID);
    }, 30_000); // Extend every 30 seconds

    try {
      // Fetch all repositories grouped by namespace (admin view)
      console.log("[RegistrySync] Fetching all repositories...");
      const groupedRepositories = await getAllRepositoriesGrouped();

      // Convert Map to plain object for JSON serialization
      const groupedObject: Record<
        string,
        Awaited<ReturnType<typeof getUserRepositories>>
      > = Object.fromEntries(groupedRepositories);

      // Calculate totals
      let totalImages = 0;
      let totalTags = 0;
      let totalRepos = 0;

      for (const repos of groupedRepositories.values()) {
        totalImages += repos.reduce((sum, r) => sum + r.imageCount, 0);
        totalTags += repos.reduce((sum, r) => sum + r.tagCount, 0);
        totalRepos += repos.length;
      }

      // Store the full admin cache
      const adminCacheData: CachedRepositories = {
        groupedRepositories: groupedObject,
        totalImages,
        totalTags,
        totalRepos,
        namespaceCount: groupedRepositories.size,
        cachedAt: new Date().toISOString(),
      };

      await setCachedData(
        "repositories:all",
        adminCacheData,
        CACHE_TTL_SECONDS,
      );
      console.log(
        `[RegistrySync] Cached admin view: ${totalRepos} repos, ${totalImages} images, ${totalTags} tags across ${groupedRepositories.size} namespaces`,
      );

      // Also cache per-namespace data for user views
      for (const [namespace, repos] of groupedRepositories.entries()) {
        const namespaceTotalImages = repos.reduce(
          (sum, r) => sum + r.imageCount,
          0,
        );
        const namespaceTotalTags = repos.reduce(
          (sum, r) => sum + r.tagCount,
          0,
        );

        const userCacheData: CachedUserRepositories = {
          repositories: repos,
          totalImages: namespaceTotalImages,
          totalTags: namespaceTotalTags,
          totalRepos: repos.length,
          cachedAt: new Date().toISOString(),
        };

        await setCachedData(
          `repositories:namespace:${namespace.toLowerCase()}`,
          userCacheData,
          CACHE_TTL_SECONDS,
        );
      }

      // Clean up expired entries
      await cleanupExpiredCache();

      const elapsed = Date.now() - startTime;
      console.log(`[RegistrySync] Sync completed in ${elapsed}ms`);
    } finally {
      clearInterval(lockExtender);
    }
  } catch (error) {
    console.error("[RegistrySync] Sync failed:", error);
  } finally {
    isRunning = false;
    await releaseSyncLock(WORKER_ID);
  }
}

/**
 * Start the registry sync worker
 * @param intervalMs Sync interval in milliseconds (default: 2 minutes)
 */
export function startRegistrySyncWorker(
  intervalMs: number = DEFAULT_SYNC_INTERVAL_MS,
): void {
  // Check if already running
  if (syncInterval) {
    console.log("[RegistrySync] Worker already running");
    return;
  }

  console.log(
    `[RegistrySync] Starting sync worker (ID: ${WORKER_ID}, interval: ${intervalMs}ms)`,
  );

  // Perform initial sync after a short delay (let the app start up)
  setTimeout(() => {
    performSync();
  }, 5000);

  // Set up recurring sync
  syncInterval = setInterval(() => {
    performSync();
  }, intervalMs);

  // Ensure the interval doesn't prevent Node from exiting
  if (syncInterval.unref) {
    syncInterval.unref();
  }
}

/**
 * Stop the registry sync worker
 */
export function stopRegistrySyncWorker(): void {
  if (syncInterval) {
    console.log("[RegistrySync] Stopping sync worker");
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

/**
 * Force an immediate sync (useful after mutations)
 */
export async function triggerImmediateSync(): Promise<void> {
  console.log("[RegistrySync] Triggering immediate sync...");
  await performSync();
}

/**
 * Get worker status
 */
export function getWorkerStatus(): {
  workerId: string;
  isRunning: boolean;
  intervalActive: boolean;
} {
  return {
    workerId: WORKER_ID,
    isRunning,
    intervalActive: syncInterval !== null,
  };
}
