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
  const access = generateGrantedAccess(scopes, "admin", true);
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

    // Calculate total size from layers
    const layers = manifest.layers || [];
    const configSize = manifest.config?.size || 0;
    const layersSize = layers.reduce(
      (sum: number, layer: { size?: number }) => sum + (layer.size || 0),
      0,
    );

    return {
      digest,
      size: configSize + layersSize,
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
    const layersSize = layers.reduce(
      (sum: number, layer: { size?: number }) => sum + (layer.size || 0),
      0,
    );

    return {
      digest: returnedDigest,
      mediaType:
        manifest.mediaType ||
        "application/vnd.docker.distribution.manifest.v2+json",
      size: configSize + layersSize,
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
    const headers = await getRegistryAuthHeader(
      `repository:${repository}:delete`,
    );

    console.log(`[deleteImage] Deleting ${repository} with digest ${digest}`);
    console.log(`[deleteImage] URL: ${url}`);

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
 * Get repositories for a specific user (by namespace)
 */
export async function getUserRepositories(
  username: string,
): Promise<UserRepository[]> {
  const allRepos = await getCatalog();
  const userNamespace = username.toLowerCase();

  // Filter repositories that belong to this user
  const userRepos = allRepos.filter((repo) => {
    const namespace = repo.split("/")[0];
    return namespace?.toLowerCase() === userNamespace;
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
 */
export async function getAllRepositoriesGrouped(): Promise<
  Map<string, UserRepository[]>
> {
  const allRepos = await getCatalog();
  const grouped = new Map<string, UserRepository[]>();

  for (const repo of allRepos) {
    const parts = repo.split("/");
    const namespace = parts[0];

    if (!grouped.has(namespace)) {
      grouped.set(namespace, []);
    }

    const tags = await getRepositoryTags(repo);

    // Skip repositories with no tags (empty/deleted repositories)
    if (tags.length === 0) {
      console.log(
        `[getAllRepositoriesGrouped] Skipping empty repository: ${repo}`,
      );
      continue;
    }

    const images = await groupTagsByDigest(repo, tags);

    grouped.get(namespace)?.push({
      name: parts.slice(1).join("/") || parts[0],
      namespace,
      fullName: repo,
      tags,
      tagCount: tags.length,
      imageCount: images.length,
      images,
    });
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
