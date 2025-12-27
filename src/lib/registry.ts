import type {
  CatalogResponse,
  ImageDetails,
  ImageInfo,
  TagsListResponse,
  UserRepository,
} from "@/types/registry";

// Registry configuration
const REGISTRY_URL = process.env.REGISTRY_URL || "http://localhost:5000";

/**
 * Create authorization header for registry API calls
 * This uses the internal service authentication, not user tokens
 */
async function getRegistryAuthHeader(
  scope: string,
): Promise<Record<string, string>> {
  // For internal API calls, we generate a token with admin access
  // This is safe because these calls are made from the server side only
  const { createRegistryToken, generateGrantedAccess, parseScopes } =
    await import("./registry-token");

  const scopes = parseScopes(scope);
  console.log(`[getRegistryAuthHeader] Parsed scopes:`, JSON.stringify(scopes));

  const access = await generateGrantedAccess(scopes, "admin", true);
  console.log(
    `[getRegistryAuthHeader] Granted access:`,
    JSON.stringify(access),
  );

  const tokenResponse = await createRegistryToken("admin", access);

  return {
    Authorization: `Bearer ${tokenResponse.token}`,
  };
}

/**
 * Make an authenticated request to the registry API
 */
async function registryFetch<T>(
  path: string,
  scope: string,
  options: RequestInit = {},
): Promise<T | null> {
  try {
    const url = `${REGISTRY_URL}${path}`;
    const headers = await getRegistryAuthHeader(scope);

    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/vnd.docker.distribution.manifest.v2+json",
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      console.error(
        `Registry API error: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("Registry API error:", error);
    return null;
  }
}

/**
 * Get all repositories from the registry catalog
 */
export async function getCatalog(): Promise<string[]> {
  const response = await registryFetch<CatalogResponse>(
    "/v2/_catalog",
    "registry:catalog:*",
  );
  return response?.repositories || [];
}

/**
 * Get tags for a specific repository
 */
export async function getRepositoryTags(repository: string): Promise<string[]> {
  console.log(
    `[getRepositoryTags] Fetching tags for repository: ${repository}`,
  );
  const response = await registryFetch<TagsListResponse>(
    `/v2/${repository}/tags/list`,
    `repository:${repository}:pull`,
  );
  const tags = response?.tags || [];
  console.log(
    `[getRepositoryTags] Found ${tags.length} tags for ${repository}:`,
    tags,
  );
  return tags;
}

/**
 * Get manifest for a specific image tag
 */
export async function getImageManifest(
  repository: string,
  reference: string,
): Promise<{
  digest: string;
  size: number;
  config: unknown;
} | null> {
  try {
    const url = `${REGISTRY_URL}/v2/${repository}/manifests/${reference}`;
    const headers = await getRegistryAuthHeader(
      `repository:${repository}:pull`,
    );

    console.log(
      `[getImageManifest] Fetching manifest for ${repository}:${reference}`,
    );

    // Accept multiple manifest formats
    const response = await fetch(url, {
      headers: {
        Accept: [
          "application/vnd.docker.distribution.manifest.v2+json",
          "application/vnd.docker.distribution.manifest.list.v2+json",
          "application/vnd.oci.image.manifest.v1+json",
          "application/vnd.oci.image.index.v1+json",
          "application/vnd.docker.distribution.manifest.v1+json",
        ].join(", "),
        ...headers,
      },
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(
        `[getImageManifest] Failed to fetch manifest: ${response.status} ${response.statusText}`,
      );
      console.error(`[getImageManifest] URL: ${url}`);
      console.error(`[getImageManifest] Response body:`, responseText);
      console.error(
        `[getImageManifest] Response headers:`,
        Object.fromEntries(response.headers.entries()),
      );
      return null;
    }

    const manifest = await response.json();
    const digest = response.headers.get("Docker-Content-Digest") || "";

    console.log(`[getImageManifest] Got digest: ${digest}`);
    console.log(
      `[getImageManifest] Manifest schema version: ${manifest.schemaVersion}, media type: ${manifest.mediaType}`,
    );

    let totalSize = 0;

    // Handle manifest lists / image indexes (multi-architecture images)
    if (
      manifest.mediaType ===
        "application/vnd.docker.distribution.manifest.list.v2+json" ||
      manifest.mediaType === "application/vnd.oci.image.index.v1+json"
    ) {
      console.log(
        `[getImageManifest] Detected manifest list with ${manifest.manifests?.length || 0} manifests`,
      );
      // For manifest lists, sum up all the manifests
      const manifests = manifest.manifests || [];
      totalSize = manifests.reduce(
        (sum: number, m: { size?: number }) => sum + (m.size || 0),
        0,
      );
    } else {
      // Handle regular manifests (v2, OCI)
      const layers = manifest.layers || [];
      const configSize = manifest.config?.size || 0;
      const layersSize = layers.reduce(
        (sum: number, layer: { size?: number }) => sum + (layer.size || 0),
        0,
      );
      totalSize = configSize + layersSize;

      console.log(
        `[getImageManifest] Calculated size - config: ${configSize}, layers: ${layersSize}, total: ${totalSize}`,
      );
    }

    return {
      digest,
      size: totalSize,
      config: manifest.config,
    };
  } catch (error) {
    console.error("[getImageManifest] Error fetching manifest:", error);
    return null;
  }
}

/**
 * Detailed manifest information for display
 */
export interface DetailedManifest {
  digest: string;
  mediaType: string;
  size: number;
  config: {
    mediaType: string;
    size: number;
    digest: string;
  } | null;
  layers: {
    mediaType: string;
    size: number;
    digest: string;
  }[];
  tags: string[];
}

/**
 * Get detailed manifest information for an image by digest
 */
export async function getDetailedManifest(
  repository: string,
  digest: string,
): Promise<DetailedManifest | null> {
  try {
    const url = `${REGISTRY_URL}/v2/${repository}/manifests/${digest}`;
    const headers = await getRegistryAuthHeader(
      `repository:${repository}:pull`,
    );

    const response = await fetch(url, {
      headers: {
        Accept: [
          "application/vnd.docker.distribution.manifest.v2+json",
          "application/vnd.oci.image.manifest.v1+json",
        ].join(", "),
        ...headers,
      },
    });

    if (!response.ok) {
      console.error(`[getDetailedManifest] Failed: ${response.status}`);
      return null;
    }

    const manifest = await response.json();
    const returnedDigest =
      response.headers.get("Docker-Content-Digest") || digest;

    // Get all tags that point to this digest
    const allTags = await getRepositoryTags(repository);
    const matchingTags: string[] = [];

    for (const tag of allTags) {
      const tagManifest = await getImageManifest(repository, tag);
      if (tagManifest?.digest === returnedDigest) {
        matchingTags.push(tag);
      }
    }

    const layers = manifest.layers || [];
    const configSize = manifest.config?.size || 0;

    let totalSize = 0;

    // Handle manifest lists / image indexes (multi-architecture images)
    if (
      manifest.mediaType ===
        "application/vnd.docker.distribution.manifest.list.v2+json" ||
      manifest.mediaType === "application/vnd.oci.image.index.v1+json"
    ) {
      // For manifest lists, sum up all the manifests
      const manifests = manifest.manifests || [];
      totalSize = manifests.reduce(
        (sum: number, m: { size?: number }) => sum + (m.size || 0),
        0,
      );
    } else {
      // Handle regular manifests (v2, OCI)
      const layersSize = layers.reduce(
        (sum: number, layer: { size?: number }) => sum + (layer.size || 0),
        0,
      );
      totalSize = configSize + layersSize;
    }

    return {
      digest: returnedDigest,
      mediaType:
        manifest.mediaType ||
        "application/vnd.docker.distribution.manifest.v2+json",
      size: totalSize,
      config: manifest.config || null,
      layers: layers.map(
        (layer: { mediaType?: string; size?: number; digest?: string }) => ({
          mediaType: layer.mediaType || "",
          size: layer.size || 0,
          digest: layer.digest || "",
        }),
      ),
      tags: matchingTags,
    };
  } catch (error) {
    console.error("[getDetailedManifest] Error:", error);
    return null;
  }
}

/**
 * Delete an image by digest
 */
export async function deleteImage(
  repository: string,
  digest: string,
): Promise<boolean> {
  try {
    const url = `${REGISTRY_URL}/v2/${repository}/manifests/${digest}`;
    const scope = `repository:${repository}:delete`;
    console.log(`[deleteImage] Requesting auth header with scope: ${scope}`);

    const headers = await getRegistryAuthHeader(scope);

    console.log(`[deleteImage] Deleting ${repository} with digest ${digest}`);
    console.log(`[deleteImage] URL: ${url}`);
    console.log(
      `[deleteImage] Auth header obtained: ${headers.Authorization ? "yes" : "no"}`,
    );

    const response = await fetch(url, {
      method: "DELETE",
      headers,
    });

    console.log(`[deleteImage] Response status: ${response.status}`);

    if (!response.ok && response.status !== 202) {
      const errorText = await response.text();
      console.error(
        `[deleteImage] Delete failed: ${response.status} ${response.statusText}`,
      );
      console.error(`[deleteImage] Error response: ${errorText}`);
    }

    return response.ok || response.status === 202;
  } catch (error) {
    console.error("[deleteImage] Error deleting image:", error);
    return false;
  }
}

/**
 * Group tags by their digest to get unique images
 */
async function groupTagsByDigest(
  repository: string,
  tags: string[],
): Promise<ImageDetails[]> {
  const digestMap = new Map<string, ImageDetails>();

  // Fetch manifests for all tags in parallel (with concurrency limit)
  const BATCH_SIZE = 5;
  for (let i = 0; i < tags.length; i += BATCH_SIZE) {
    const batch = tags.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (tag) => {
        const manifest = await getImageManifest(repository, tag);
        return { tag, manifest };
      }),
    );

    for (const { tag, manifest } of results) {
      if (!manifest?.digest) continue;

      const existing = digestMap.get(manifest.digest);
      if (existing) {
        existing.tags.push(tag);
      } else {
        digestMap.set(manifest.digest, {
          digest: manifest.digest,
          tags: [tag],
          size: manifest.size,
        });
      }
    }
  }

  return Array.from(digestMap.values());
}

/**
 * Get repositories for a specific user (by their namespaces)
 */
export async function getUserRepositories(
  userId: number,
): Promise<UserRepository[]> {
  const allRepos = await getCatalog();

  // Get user's namespaces from database
  const { db, schema } = await import("@/db");
  const { eq } = await import("drizzle-orm");

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    with: {
      namespaces: true,
    },
  });

  if (!user) {
    return [];
  }

  // Create a set of lowercase namespace names for fast lookup
  const userNamespaces = new Set(
    user.namespaces.map((ns) => ns.name.toLowerCase()),
  );

  // Filter repositories that belong to any of this user's namespaces
  const userRepos = allRepos.filter((repo) => {
    const namespace = repo.split("/")[0];
    return namespace && userNamespaces.has(namespace.toLowerCase());
  });

  // Get tags for each repository
  const repositories: UserRepository[] = [];

  for (const repo of userRepos) {
    const tags = await getRepositoryTags(repo);

    // Skip repositories with no tags (empty/deleted repositories)
    if (tags.length === 0) {
      console.log(`[getUserRepositories] Skipping empty repository: ${repo}`);
      continue;
    }

    const parts = repo.split("/");
    const images = await groupTagsByDigest(repo, tags);

    repositories.push({
      name: parts.slice(1).join("/") || parts[0],
      namespace: parts[0],
      fullName: repo,
      tags,
      tagCount: tags.length,
      imageCount: images.length,
      images,
    });
  }

  return repositories;
}

/**
 * Get all repositories grouped by user (for admin view)
 * Also identifies orphaned repositories (those without a matching namespace in the database)
 */
export async function getAllRepositoriesGrouped(): Promise<
  Map<string, UserRepository[]>
> {
  const allRepos = await getCatalog();
  const grouped = new Map<string, UserRepository[]>();

  // Get all existing namespaces from the database
  const { db } = await import("@/db");
  const existingNamespaces = await db.query.namespaces.findMany({
    columns: { name: true },
  });
  const namespaceSet = new Set(
    existingNamespaces.map((ns) => ns.name.toLowerCase()),
  );

  for (const repo of allRepos) {
    const parts = repo.split("/");
    const namespace = parts[0];

    const tags = await getRepositoryTags(repo);

    // Skip repositories with no tags (empty/deleted repositories)
    if (tags.length === 0) {
      console.log(
        `[getAllRepositoriesGrouped] Skipping empty repository: ${repo}`,
      );
      continue;
    }

    if (!grouped.has(namespace)) {
      grouped.set(namespace, []);
    }

    const images = await groupTagsByDigest(repo, tags);
    const isOrphan = !namespaceSet.has(namespace.toLowerCase());

    if (isOrphan) {
      console.log(
        `[getAllRepositoriesGrouped] Found orphaned repository: ${repo} (namespace "${namespace}" does not exist)`,
      );
    }

    grouped.get(namespace)?.push({
      name: parts.slice(1).join("/") || parts[0],
      namespace,
      fullName: repo,
      tags,
      tagCount: tags.length,
      imageCount: images.length,
      images,
      isOrphan,
    });
  }

  // Filter out namespaces with no repositories
  for (const [namespace, repos] of grouped.entries()) {
    if (repos.length === 0) {
      console.log(
        `[getAllRepositoriesGrouped] Removing empty namespace: ${namespace}`,
      );
      grouped.delete(namespace);
    }
  }

  return grouped;
}

/**
 * Get a single repository with detailed image information
 */
export async function getRepository(
  fullName: string,
): Promise<UserRepository | null> {
  const tags = await getRepositoryTags(fullName);

  if (tags.length === 0) {
    return null;
  }

  const parts = fullName.split("/");
  const images = await groupTagsByDigest(fullName, tags);

  return {
    name: parts.slice(1).join("/") || parts[0],
    namespace: parts[0],
    fullName,
    tags,
    tagCount: tags.length,
    imageCount: images.length,
    images,
  };
}

/**
 * Get detailed image information
 */
export async function getImageInfo(
  repository: string,
  tag: string,
): Promise<ImageInfo | null> {
  const manifest = await getImageManifest(repository, tag);

  if (!manifest) {
    return null;
  }

  return {
    repository,
    tag,
    digest: manifest.digest,
    size: manifest.size,
  };
}

/**
 * Check if registry is available
 */
export async function checkRegistryHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${REGISTRY_URL}/v2/`, {
      method: "GET",
    });
    // Registry returns 401 when auth is required, which means it's running
    return response.ok || response.status === 401;
  } catch {
    return false;
  }
}

/**
 * Format bytes to human readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
