import { eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { registryCache, registrySyncLock } from "@/db/schema";
import type { UserRepository } from "@/types/registry";

// Default cache TTL: 5 minutes
const DEFAULT_TTL_SECONDS = 300;

// Sync lock expiration: 2 minutes (in case worker crashes)
const LOCK_EXPIRATION_SECONDS = 120;

export interface CachedRepositories {
  groupedRepositories: Record<string, UserRepository[]>;
  totalImages: number;
  totalTags: number;
  totalRepos: number;
  namespaceCount: number;
  cachedAt: string;
}

export interface CachedUserRepositories {
  repositories: UserRepository[];
  totalImages: number;
  totalTags: number;
  totalRepos: number;
  cachedAt: string;
}

/**
 * Get cached data by key
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const cached = await db.query.registryCache.findFirst({
      where: eq(registryCache.id, key),
    });

    if (!cached) {
      return null;
    }

    // Check if expired
    if (cached.expiresAt < new Date()) {
      return null;
    }

    return JSON.parse(cached.data) as T;
  } catch (error) {
    console.error(
      `[RegistryCache] Error getting cached data for ${key}:`,
      error,
    );
    return null;
  }
}

/**
 * Set cached data with TTL
 */
export async function setCachedData<T>(
  key: string,
  data: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    await db
      .insert(registryCache)
      .values({
        id: key,
        data: JSON.stringify(data),
        expiresAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: registryCache.id,
        set: {
          data: JSON.stringify(data),
          expiresAt,
          updatedAt: now,
        },
      });
  } catch (error) {
    console.error(
      `[RegistryCache] Error setting cached data for ${key}:`,
      error,
    );
  }
}

/**
 * Invalidate cache by key or all cache entries
 */
export async function invalidateCache(key?: string): Promise<void> {
  try {
    if (key) {
      await db.delete(registryCache).where(eq(registryCache.id, key));
    } else {
      // Clear all cache entries
      await db.delete(registryCache);
    }
    console.log(
      `[RegistryCache] Cache invalidated${key ? ` for key: ${key}` : " (all)"}`,
    );
  } catch (error) {
    console.error("[RegistryCache] Error invalidating cache:", error);
  }
}

/**
 * Check if cache is stale (expired or doesn't exist)
 */
export async function isCacheStale(key: string): Promise<boolean> {
  try {
    const cached = await db.query.registryCache.findFirst({
      where: eq(registryCache.id, key),
    });

    if (!cached) {
      return true;
    }

    return cached.expiresAt < new Date();
  } catch (error) {
    console.error(
      `[RegistryCache] Error checking cache staleness for ${key}:`,
      error,
    );
    return true;
  }
}

/**
 * Get cache metadata (for debugging/status)
 */
export async function getCacheStatus(): Promise<{
  entries: number;
  keys: string[];
  oldestEntry: Date | null;
  newestEntry: Date | null;
}> {
  try {
    const entries = await db.select().from(registryCache);

    if (entries.length === 0) {
      return {
        entries: 0,
        keys: [],
        oldestEntry: null,
        newestEntry: null,
      };
    }

    const sortedByDate = [...entries].sort(
      (a, b) => a.updatedAt.getTime() - b.updatedAt.getTime(),
    );

    return {
      entries: entries.length,
      keys: entries.map((e) => e.id),
      oldestEntry: sortedByDate[0].updatedAt,
      newestEntry: sortedByDate[sortedByDate.length - 1].updatedAt,
    };
  } catch (error) {
    console.error("[RegistryCache] Error getting cache status:", error);
    return {
      entries: 0,
      keys: [],
      oldestEntry: null,
      newestEntry: null,
    };
  }
}

/**
 * Clean up expired cache entries
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const result = await db
      .delete(registryCache)
      .where(lt(registryCache.expiresAt, new Date()))
      .returning();

    if (result.length > 0) {
      console.log(
        `[RegistryCache] Cleaned up ${result.length} expired cache entries`,
      );
    }

    return result.length;
  } catch (error) {
    console.error("[RegistryCache] Error cleaning up expired cache:", error);
    return 0;
  }
}

/**
 * Acquire sync lock to prevent multiple workers from syncing
 */
export async function acquireSyncLock(workerId: string): Promise<boolean> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_EXPIRATION_SECONDS * 1000);

    // Check if lock exists and is still valid
    const existingLock = await db.query.registrySyncLock.findFirst({
      where: eq(registrySyncLock.id, "sync_lock"),
    });

    if (existingLock?.expiresAt && existingLock.expiresAt > now) {
      // Lock is held by another worker
      return false;
    }

    // Acquire or update lock
    await db
      .insert(registrySyncLock)
      .values({
        id: "sync_lock",
        lockedAt: now,
        lockedBy: workerId,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: registrySyncLock.id,
        set: {
          lockedAt: now,
          lockedBy: workerId,
          expiresAt,
        },
      });

    return true;
  } catch (error) {
    console.error("[RegistryCache] Error acquiring sync lock:", error);
    return false;
  }
}

/**
 * Release sync lock
 */
export async function releaseSyncLock(workerId: string): Promise<void> {
  try {
    const lock = await db.query.registrySyncLock.findFirst({
      where: eq(registrySyncLock.id, "sync_lock"),
    });

    // Only release if we own the lock
    if (lock && lock.lockedBy === workerId) {
      await db
        .update(registrySyncLock)
        .set({
          lockedAt: null,
          lockedBy: null,
          expiresAt: null,
        })
        .where(eq(registrySyncLock.id, "sync_lock"));
    }
  } catch (error) {
    console.error("[RegistryCache] Error releasing sync lock:", error);
  }
}

/**
 * Extend lock expiration while syncing
 */
export async function extendSyncLock(workerId: string): Promise<boolean> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_EXPIRATION_SECONDS * 1000);

    const lock = await db.query.registrySyncLock.findFirst({
      where: eq(registrySyncLock.id, "sync_lock"),
    });

    if (!lock || lock.lockedBy !== workerId) {
      return false;
    }

    await db
      .update(registrySyncLock)
      .set({ expiresAt })
      .where(eq(registrySyncLock.id, "sync_lock"));

    return true;
  } catch (error) {
    console.error("[RegistryCache] Error extending sync lock:", error);
    return false;
  }
}
