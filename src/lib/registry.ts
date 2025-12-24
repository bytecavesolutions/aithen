import type {
  CatalogResponse,
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
  const response = await registryFetch<TagsListResponse>(
    `/v2/${repository}/tags/list`,
    `repository:${repository}:pull`,
  );
  return response?.tags || [];
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

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.docker.distribution.manifest.v2+json",
        ...headers,
      },
    });

    if (!response.ok) {
      return null;
    }

    const manifest = await response.json();
    const digest = response.headers.get("Docker-Content-Digest") || "";

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
    console.error("Error fetching manifest:", error);
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

    const response = await fetch(url, {
      method: "DELETE",
      headers,
    });

    return response.ok || response.status === 202;
  } catch (error) {
    console.error("Error deleting image:", error);
    return false;
  }
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
    const parts = repo.split("/");

    repositories.push({
      name: parts.slice(1).join("/") || parts[0],
      namespace: parts[0],
      fullName: repo,
      tags,
      imageCount: tags.length,
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

    grouped.get(namespace)?.push({
      name: parts.slice(1).join("/") || parts[0],
      namespace,
      fullName: repo,
      tags,
      imageCount: tags.length,
    });
  }

  return grouped;
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
