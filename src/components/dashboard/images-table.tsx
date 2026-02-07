"use client";

import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Container,
  Cpu,
  Filter,
  Hash,
  Layers,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PlatformInfo } from "@/types/registry";

interface ImageDetails {
  digest: string;
  tags: string[];
  size: number;
  created?: string;
  isMultiArch?: boolean;
  platforms?: PlatformInfo[];
  architecture?: string;
  os?: string;
  layerCount?: number;
  mediaType?: string;
}

interface UserRepository {
  name: string;
  namespace: string;
  fullName: string;
  tags: string[];
  imageCount: number;
  tagCount: number;
  images: ImageDetails[];
  isOrphan?: boolean;
}

interface ImagesTableProps {
  repositories?: UserRepository[];
  groupedRepositories?: Record<string, UserRepository[]>;
  isAdmin: boolean;
  userNamespaces?: string[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function truncateDigest(digest: string): string {
  if (!digest) return "";
  const hash = digest.replace("sha256:", "");
  return hash.substring(0, 12);
}

function formatPlatform(arch: string, os?: string): string {
  if (os && os !== "linux") {
    return `${os}/${arch}`;
  }
  return arch;
}

function getArchitectureColor(arch: string): string {
  if (arch.includes("amd64") || arch.includes("x86_64")) {
    return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
  }
  if (arch.includes("arm64") || arch.includes("aarch64")) {
    return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
  }
  if (arch.includes("arm")) {
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  }
  if (arch.includes("386") || arch.includes("i386")) {
    return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
  }
  if (arch.includes("s390x") || arch.includes("ppc64")) {
    return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
  }
  return "bg-muted text-muted-foreground";
}

export function ImagesTable({
  repositories = [],
  groupedRepositories,
  isAdmin,
  userNamespaces = [],
}: ImagesTableProps) {
  const [expandedNamespaces, setExpandedNamespaces] = useState<Set<string>>(
    new Set(),
  );
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    repository: string;
    digest: string;
    tags: string[];
  }>({ open: false, repository: "", digest: "", tags: [] });
  const [deleteRepoDialog, setDeleteRepoDialog] = useState<{
    open: boolean;
    repository: string;
    imageCount: number;
    tagCount: number;
  }>({ open: false, repository: "", imageCount: 0, tagCount: 0 });
  const [isDeleting, setIsDeleting] = useState(false);

  // Get all namespaces from grouped repositories (memoized)
  const allNamespaces = useMemo(() => {
    if (!groupedRepositories) return [];
    return Object.keys(groupedRepositories).sort();
  }, [groupedRepositories]);

  // Default filter state - show user's namespaces by default
  const [selectedNamespace, setSelectedNamespace] =
    useState<string>("my-namespaces");

  // Filter namespaces based on selection
  // Only show namespaces that actually have repositories in the registry
  const namespaces = useMemo(() => {
    if (!isAdmin || !groupedRepositories) return [];

    // Filter to only namespaces with actual repositories
    const availableNamespaces = allNamespaces.filter(
      (ns) => groupedRepositories[ns],
    );

    if (selectedNamespace === "all") return availableNamespaces;
    if (selectedNamespace === "my-namespaces") {
      // Filter user namespaces to only those with repositories
      const userNsWithRepos = userNamespaces.filter(
        (ns) => groupedRepositories[ns],
      );
      return userNsWithRepos.length > 0 ? userNsWithRepos : availableNamespaces;
    }
    return availableNamespaces.filter((ns) => ns === selectedNamespace);
  }, [
    allNamespaces,
    selectedNamespace,
    userNamespaces,
    isAdmin,
    groupedRepositories,
  ]);

  // Calculate stats for filtered view
  const stats = useMemo(() => {
    if (!isAdmin || !groupedRepositories)
      return { totalRepos: 0, totalImages: 0, totalTags: 0 };
    return namespaces.reduce(
      (acc, ns) => {
        const repos = groupedRepositories[ns];
        // Skip if namespace has no repositories in registry
        if (!repos) return acc;
        repos.forEach((repo) => {
          acc.totalRepos++;
          acc.totalImages += repo.imageCount;
          acc.totalTags += repo.tagCount;
        });
        return acc;
      },
      { totalRepos: 0, totalImages: 0, totalTags: 0 },
    );
  }, [namespaces, groupedRepositories, isAdmin]);

  const toggleNamespace = (namespace: string) => {
    const newExpanded = new Set(expandedNamespaces);
    if (newExpanded.has(namespace)) {
      newExpanded.delete(namespace);
    } else {
      newExpanded.add(namespace);
    }
    setExpandedNamespaces(newExpanded);
  };

  const toggleRepo = (repoName: string) => {
    const newExpanded = new Set(expandedRepos);
    if (newExpanded.has(repoName)) {
      newExpanded.delete(repoName);
    } else {
      newExpanded.add(repoName);
    }
    setExpandedRepos(newExpanded);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      console.log(
        `[ImagesTable] Deleting ${deleteDialog.repository} digest ${deleteDialog.digest}`,
      );
      const response = await fetch("/api/registry/images/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository: deleteDialog.repository,
          digest: deleteDialog.digest,
        }),
      });

      if (response.ok) {
        console.log(`[ImagesTable] Delete successful, reloading page`);
        // Refresh the page to show updated data
        window.location.reload();
      } else {
        // Try to parse JSON, but handle non-JSON responses gracefully
        let errorMessage = `Failed to delete image (HTTP ${response.status})`;
        try {
          const errorText = await response.text();
          console.error(
            `[ImagesTable] Delete failed - Status: ${response.status}, Response:`,
            errorText,
          );
          if (errorText) {
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.error || errorMessage;
            } catch {
              errorMessage = errorText || errorMessage;
            }
          }
        } catch (e) {
          console.error(`[ImagesTable] Could not read error response:`, e);
        }
        alert(errorMessage);
      }
    } catch (error) {
      console.error(`[ImagesTable] Delete error:`, error);
      alert(
        `Failed to delete image: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsDeleting(false);
      setDeleteDialog({ open: false, repository: "", digest: "", tags: [] });
    }
  };

  const handleDeleteRepository = async () => {
    setIsDeleting(true);
    try {
      console.log(
        `[ImagesTable] Deleting all images in repository ${deleteRepoDialog.repository}`,
      );
      const response = await fetch("/api/registry/images/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository: deleteRepoDialog.repository,
          deleteAll: true,
        }),
      });

      if (response.ok) {
        console.log(
          `[ImagesTable] Delete repository successful, reloading page`,
        );
        // Refresh the page to show updated data
        window.location.reload();
      } else {
        let errorMessage = `Failed to delete repository (HTTP ${response.status})`;
        try {
          const errorText = await response.text();
          console.error(
            `[ImagesTable] Delete repository failed - Status: ${response.status}, Response:`,
            errorText,
          );
          if (errorText) {
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.error || errorMessage;
            } catch {
              errorMessage = errorText || errorMessage;
            }
          }
        } catch (e) {
          console.error(`[ImagesTable] Could not read error response:`, e);
        }
        alert(errorMessage);
      }
    } catch (error) {
      console.error(`[ImagesTable] Delete repository error:`, error);
      alert(
        `Failed to delete repository: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsDeleting(false);
      setDeleteRepoDialog({
        open: false,
        repository: "",
        imageCount: 0,
        tagCount: 0,
      });
    }
  };

  const renderImageRow = (
    repo: UserRepository,
    image: ImageDetails,
    isNested = false,
  ) => (
    <TableRow key={`${repo.fullName}-${image.digest}`} className="group">
      <TableCell className={isNested ? "pl-8 sm:pl-16" : ""}>
        <div className="flex items-center gap-2">
          <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Link
            href={`/dashboard/repositories/${repo.namespace}/${repo.name}/images/${encodeURIComponent(image.digest)}`}
            className="font-mono text-xs sm:text-sm hover:underline"
          >
            {truncateDigest(image.digest)}
          </Link>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {image.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="font-mono text-xs">
              <Tag className="mr-1 h-3 w-3" />
              {tag}
            </Badge>
          ))}
          {image.tags.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{image.tags.length - 2}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <div className="flex flex-wrap gap-1">
          {image.isMultiArch && image.platforms ? (
            <>
              {image.platforms
                .filter(
                  (p) => p.architecture !== "unknown" && p.os !== "unknown",
                )
                .slice(0, 4)
                .map((p) => (
                  <Badge
                    key={p.digest}
                    variant="outline"
                    className={`text-xs ${getArchitectureColor(p.architecture)}`}
                    title={`${p.os}/${p.architecture} - ${formatBytes(p.size)} (${p.layerCount} layers)`}
                  >
                    <Cpu className="mr-1 h-3 w-3" />
                    {formatPlatform(p.architecture, p.os)}
                  </Badge>
                ))}
              {image.platforms.filter(
                (p) => p.architecture !== "unknown" && p.os !== "unknown",
              ).length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +
                  {image.platforms.filter(
                    (p) => p.architecture !== "unknown" && p.os !== "unknown",
                  ).length - 4}{" "}
                  more
                </Badge>
              )}
            </>
          ) : image.architecture && image.architecture !== "unknown" ? (
            <Badge
              variant="outline"
              className={`text-xs ${getArchitectureColor(image.architecture)}`}
            >
              <Cpu className="mr-1 h-3 w-3" />
              {formatPlatform(image.architecture, image.os)}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {image.layerCount !== undefined && image.layerCount > 0 ? (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            <span>{image.layerCount}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right font-mono text-xs sm:text-sm">
        {formatBytes(image.size)}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-destructive opacity-0 group-hover:opacity-100 hover:text-destructive"
          onClick={() =>
            setDeleteDialog({
              open: true,
              repository: repo.fullName,
              digest: image.digest,
              tags: image.tags,
            })
          }
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );

  const renderRepositorySection = (
    repo: UserRepository,
    showNamespace = false,
  ) => {
    const isExpanded = expandedRepos.has(repo.fullName);
    const displayName = showNamespace ? repo.fullName : repo.name;

    return (
      <div key={repo.fullName} className="border-b last:border-b-0">
        <div className="flex flex-col sm:flex-row w-full sm:items-center justify-between gap-2 sm:gap-0 pl-4 sm:pl-8 pr-4 py-3.5 hover:bg-muted/50 transition-colors group/repo">
          <button
            type="button"
            className="flex items-start sm:items-center gap-2 sm:gap-3 flex-1 text-left min-w-0"
            onClick={() => toggleRepo(repo.fullName)}
          >
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Container className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
              <Link
                href={`/dashboard/repositories/${repo.namespace}/${repo.name}`}
                className="font-medium font-mono text-sm sm:text-base truncate hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {displayName}
              </Link>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Hash className="h-3 w-3" />
                  {repo.imageCount} {repo.imageCount === 1 ? "image" : "images"}
                </Badge>
                <Badge variant="outline" className="gap-1 text-xs">
                  <Tag className="h-3 w-3" />
                  {repo.tagCount} {repo.tagCount === 1 ? "tag" : "tags"}
                </Badge>
              </div>
            </div>
          </button>
          <div className="flex items-center gap-2 ml-10 sm:ml-0">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive opacity-0 group-hover/repo:opacity-100 hover:text-destructive"
              onClick={() => {
                setDeleteRepoDialog({
                  open: true,
                  repository: repo.fullName,
                  imageCount: repo.imageCount,
                  tagCount: repo.tagCount,
                });
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isExpanded && repo.images && (
          <div className="border-t bg-muted/30 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-8 sm:pl-16">Digest</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Architecture
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Layers</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead className="text-right w-16 sm:w-20">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repo.images.map((image) => renderImageRow(repo, image, true))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  };

  // Admin view with grouped repositories
  if (isAdmin && groupedRepositories) {
    if (allNamespaces.length === 0) {
      return (
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">
              All Repositories
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Container images from all users
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Container className="h-12 w-12 opacity-50" />
              <p className="mt-4 text-sm sm:text-base">No images in registry</p>
              <p className="text-xs sm:text-sm">
                Users can push images to their namespace
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <>
        <Card>
          <CardHeader className="px-4 sm:px-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-base sm:text-lg">
                  {selectedNamespace === "all"
                    ? "All Repositories"
                    : selectedNamespace === "my-namespaces"
                      ? "My Repositories"
                      : `${selectedNamespace}/ Repositories`}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {selectedNamespace === "all"
                    ? "Container images from all users"
                    : selectedNamespace === "my-namespaces"
                      ? "Your container images"
                      : `Container images in ${selectedNamespace} namespace`}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {stats.totalRepos}{" "}
                  {stats.totalRepos === 1 ? "repository" : "repositories"}
                </Badge>
                <Badge variant="outline" className="gap-1 text-xs">
                  <Hash className="h-3 w-3" />
                  {stats.totalImages}{" "}
                  {stats.totalImages === 1 ? "image" : "images"}
                </Badge>
                <Badge variant="outline" className="gap-1 text-xs">
                  <Tag className="h-3 w-3" />
                  {stats.totalTags} {stats.totalTags === 1 ? "tag" : "tags"}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedNamespace}
                onValueChange={setSelectedNamespace}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Show images from..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {userNamespaces.length > 0 && (
                    <SelectItem value="my-namespaces">
                      My Images ({userNamespaces.length} namespaces)
                    </SelectItem>
                  )}
                  {allNamespaces.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        All Namespaces
                      </div>
                      {allNamespaces.map((ns) => (
                        <SelectItem key={ns} value={ns}>
                          {ns}/
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              {selectedNamespace !== "my-namespaces" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedNamespace("my-namespaces")}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {namespaces.map((namespace) => {
                const repos = groupedRepositories[namespace];
                // Skip namespaces that don't have repositories in registry yet
                if (!repos) return null;
                const isExpanded = expandedNamespaces.has(namespace);
                const totalImages = repos.reduce(
                  (sum, r) => sum + r.imageCount,
                  0,
                );
                const totalTags = repos.reduce((sum, r) => sum + r.tagCount, 0);

                return (
                  <div key={namespace} className="py-1">
                    <button
                      type="button"
                      className="flex w-full items-start sm:items-center p-3 sm:p-4 hover:bg-muted/50 transition-colors font-semibold"
                      onClick={() => toggleNamespace(namespace)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full">
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium font-mono text-sm sm:text-base">
                            {namespace}/
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 ml-8 sm:ml-0">
                          {repos.some((r) => r.isOrphan) && (
                            <Badge
                              variant="destructive"
                              className="gap-1 text-xs"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              No Namespace
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {repos.length}{" "}
                            {repos.length === 1 ? "repository" : "repositories"}
                          </Badge>
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Hash className="h-3 w-3" />
                            {totalImages}{" "}
                            {totalImages === 1 ? "image" : "images"}
                          </Badge>
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Tag className="h-3 w-3" />
                            {totalTags} {totalTags === 1 ? "tag" : "tags"}
                          </Badge>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t bg-muted/10 pb-2">
                        {repos.map((repo) => renderRepositorySection(repo))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={deleteDialog.open}
          onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Image</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete image{" "}
                <code className="rounded bg-muted px-1">
                  {truncateDigest(deleteDialog.digest)}
                </code>{" "}
                from{" "}
                <code className="rounded bg-muted px-1">
                  {deleteDialog.repository}
                </code>
                ?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {deleteDialog.tags.length > 0 && (
                <p className="text-destructive text-sm">
                  This will remove {deleteDialog.tags.length} tag
                  {deleteDialog.tags.length > 1 ? "s" : ""}:{" "}
                  {deleteDialog.tags.join(", ")}
                </p>
              )}
              <p className="font-medium text-sm">
                This action cannot be undone.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  setDeleteDialog({
                    open: false,
                    repository: "",
                    digest: "",
                    tags: [],
                  })
                }
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Image"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={deleteRepoDialog.open}
          onOpenChange={(open) =>
            setDeleteRepoDialog({ ...deleteRepoDialog, open })
          }
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete All Images</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete all images in{" "}
                <code className="rounded bg-muted px-1">
                  {deleteRepoDialog.repository}
                </code>
                ?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="text-destructive font-medium text-sm">
                This will permanently delete:
                <ul className="list-disc list-inside mt-2">
                  <li>
                    {deleteRepoDialog.imageCount}{" "}
                    {deleteRepoDialog.imageCount === 1 ? "image" : "images"}
                  </li>
                  <li>
                    {deleteRepoDialog.tagCount}{" "}
                    {deleteRepoDialog.tagCount === 1 ? "tag" : "tags"}
                  </li>
                </ul>
              </div>
              <p className="font-medium text-sm">
                This action cannot be undone.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  setDeleteRepoDialog({
                    open: false,
                    repository: "",
                    imageCount: 0,
                    tagCount: 0,
                  })
                }
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteRepository}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete All Images"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Regular user view
  if (repositories.length === 0) {
    return (
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg">
            Your Repositories
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Container images in your namespace
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Container className="h-12 w-12 opacity-50" />
            <p className="mt-4 text-sm sm:text-base">No images yet</p>
            <p className="text-xs sm:text-sm">
              Push your first image to get started
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg">
            Your Repositories
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Container images in your namespace
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {repositories.map((repo) => renderRepositorySection(repo, true))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Image</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete image{" "}
              <code className="rounded bg-muted px-1">
                {truncateDigest(deleteDialog.digest)}
              </code>{" "}
              from{" "}
              <code className="rounded bg-muted px-1">
                {deleteDialog.repository}
              </code>
              ?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {deleteDialog.tags.length > 0 && (
              <p className="text-destructive text-sm">
                This will remove {deleteDialog.tags.length} tag
                {deleteDialog.tags.length > 1 ? "s" : ""}:{" "}
                {deleteDialog.tags.join(", ")}
              </p>
            )}
            <p className="font-medium text-sm">This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDeleteDialog({
                  open: false,
                  repository: "",
                  digest: "",
                  tags: [],
                })
              }
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Image"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteRepoDialog.open}
        onOpenChange={(open) =>
          setDeleteRepoDialog({ ...deleteRepoDialog, open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Images</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all images in{" "}
              <code className="rounded bg-muted px-1">
                {deleteRepoDialog.repository}
              </code>
              ?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-destructive font-medium text-sm">
              This will permanently delete:
              <ul className="list-disc list-inside mt-2">
                <li>
                  {deleteRepoDialog.imageCount}{" "}
                  {deleteRepoDialog.imageCount === 1 ? "image" : "images"}
                </li>
                <li>
                  {deleteRepoDialog.tagCount}{" "}
                  {deleteRepoDialog.tagCount === 1 ? "tag" : "tags"}
                </li>
              </ul>
            </div>
            <p className="font-medium text-sm">This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDeleteRepoDialog({
                  open: false,
                  repository: "",
                  imageCount: 0,
                  tagCount: 0,
                })
              }
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRepository}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete All Images"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
