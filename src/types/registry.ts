/**
 * Docker Registry Token Types
 * Based on Docker Registry v2 Token Authentication Specification
 */

/**
 * Access entry for a single resource in the token
 */
export interface TokenAccess {
  type: "repository" | "registry";
  name: string;
  actions: ("push" | "pull" | "delete" | "*")[];
}

/**
 * JWT Claims for Docker Registry Token
 */
export interface RegistryTokenClaims {
  /** Issuer - identifies the token issuer (e.g., "aithen-auth") */
  iss: string;
  /** Subject - the user identifier */
  sub: string;
  /** Audience - the registry service name */
  aud: string;
  /** Expiration time (Unix timestamp) */
  exp: number;
  /** Not before time (Unix timestamp) */
  nbf: number;
  /** Issued at time (Unix timestamp) */
  iat: number;
  /** JWT ID - unique identifier for the token */
  jti: string;
  /** Access grants - list of resources and actions */
  access: TokenAccess[];
}

/**
 * Token request parameters from the registry
 */
export interface TokenRequest {
  /** The service name (registry identifier) */
  service: string;
  /** Client identifier (optional) */
  client_id?: string;
  /** Whether to return a refresh token */
  offline_token?: boolean;
  /** Requested scopes in format: type:name:actions */
  scope?: string | string[];
  /** Account identifier (from basic auth) */
  account?: string;
}

/**
 * Parsed scope from token request
 */
export interface ParsedScope {
  type: "repository" | "registry";
  name: string;
  actions: string[];
}

/**
 * Token response returned to the Docker client
 */
export interface TokenResponse {
  /** The JWT token */
  token: string;
  /** Alias for token (OAuth 2.0 compatibility) */
  access_token: string;
  /** Token lifetime in seconds */
  expires_in: number;
  /** ISO 8601 timestamp of when token was issued */
  issued_at: string;
  /** Refresh token (only if offline_token was requested) */
  refresh_token?: string;
}

/**
 * Registry catalog response
 */
export interface CatalogResponse {
  repositories: string[];
}

/**
 * Registry tags list response
 */
export interface TagsListResponse {
  name: string;
  tags: string[];
}

/**
 * Image manifest (simplified)
 */
export interface ImageManifest {
  schemaVersion: number;
  mediaType: string;
  config: {
    mediaType: string;
    size: number;
    digest: string;
  };
  layers: {
    mediaType: string;
    size: number;
    digest: string;
  }[];
}

/**
 * Parsed image reference
 */
export interface ImageReference {
  /** Repository namespace (usually username) */
  namespace: string;
  /** Repository name (without namespace) */
  name: string;
  /** Full repository path (namespace/name) */
  repository: string;
  /** Tag or digest */
  reference: string;
}

/**
 * Image info with metadata for display
 */
export interface ImageInfo {
  repository: string;
  tag: string;
  digest?: string;
  size?: number;
  created?: string;
  architecture?: string;
  os?: string;
}

/**
 * Platform information for multi-arch images
 */
export interface PlatformInfo {
  /** Architecture (e.g., amd64, arm64, arm/v7) */
  architecture: string;
  /** OS (e.g., linux, windows) */
  os: string;
  /** Variant (e.g., v7, v8 for ARM) */
  variant?: string;
  /** Digest for this specific platform manifest */
  digest: string;
  /** Size of this platform's image */
  size: number;
  /** Number of layers in this platform's image */
  layerCount: number;
}

/**
 * Layer information
 */
export interface LayerInfo {
  /** Layer digest */
  digest: string;
  /** Media type */
  mediaType: string;
  /** Compressed size in bytes */
  size: number;
}

/**
 * Detailed image information with digest and associated tags
 */
export interface ImageDetails {
  /** The unique digest (sha256:...) for this image */
  digest: string;
  /** All tags pointing to this digest */
  tags: string[];
  /** Total size in bytes */
  size: number;
  /** Created timestamp (if available) */
  created?: string;
  /** Architecture (e.g., amd64, arm64) - for single-arch images */
  architecture?: string;
  /** OS (e.g., linux, windows) - for single-arch images */
  os?: string;
  /** Whether this is a multi-architecture manifest list */
  isMultiArch?: boolean;
  /** Platform information for multi-arch images */
  platforms?: PlatformInfo[];
  /** Number of layers (for single-arch) or total across platforms */
  layerCount?: number;
  /** Media type of the manifest */
  mediaType?: string;
}

/**
 * User's repository with images
 */
export interface UserRepository {
  name: string;
  namespace: string;
  fullName: string;
  /** @deprecated Use images array instead */
  tags: string[];
  /** Unique image count (by digest) */
  imageCount: number;
  /** Total tag count */
  tagCount: number;
  /** Detailed images with digest-to-tags mapping */
  images: ImageDetails[];
  /** Whether this repository's namespace doesn't exist in the database */
  isOrphan?: boolean;
}
