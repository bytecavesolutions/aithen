"use client";

import {
  ChevronDown,
  ChevronRight,
  Container,
  ExternalLink,
  Hash,
  Tag,
  Trash2,
  User,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ImageDetails {
  digest: string;
  tags: string[];
  size: number;
  created?: string;
}

interface UserRepository {
  name: string;
  namespace: string;
  fullName: string;
  tags: string[];
  imageCount: number;
  tagCount: number;
  images: ImageDetails[];
}

interface ImagesTableProps {
  repositories?: UserRepository[];
  groupedRepositories?: Record<string, UserRepository[]>;
  isAdmin: boolean;
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

export function ImagesTable({
  repositories = [],
  groupedRepositories,
  isAdmin,
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
  const [isDeleting, setIsDeleting] = useState(false);

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
        const error = await response.json();
        console.error(`[ImagesTable] Delete failed:`, error);
        alert(error.error || "Failed to delete image");
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

  const renderImageRow = (
    repo: UserRepository,
    image: ImageDetails,
    isNested = false,
  ) => (
    <TableRow key={`${repo.fullName}-${image.digest}`} className="group">
      <TableCell className={isNested ? "pl-12" : ""}>
        <div className="flex items-center gap-2">
          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
          <Link
            href={`/dashboard/repositories/${repo.namespace}/${repo.name}/images/${encodeURIComponent(image.digest)}`}
            className="font-mono text-sm hover:underline"
          >
            {truncateDigest(image.digest)}
          </Link>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {image.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="secondary" className="font-mono text-xs">
              <Tag className="mr-1 h-3 w-3" />
              {tag}
            </Badge>
          ))}
          {image.tags.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{image.tags.length - 4} more
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
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
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
          onClick={() => toggleRepo(repo.fullName)}
        >
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <Container className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium font-mono">{displayName}</span>
            <Badge variant="secondary" className="gap-1">
              <Hash className="h-3 w-3" />
              {repo.imageCount} {repo.imageCount === 1 ? "image" : "images"}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Tag className="h-3 w-3" />
              {repo.tagCount} {repo.tagCount === 1 ? "tag" : "tags"}
            </Badge>
          </div>
          <Link
            href={`/dashboard/repositories/${repo.namespace}/${repo.name}`}
            className="text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </button>

        {isExpanded && repo.images && (
          <div className="border-t bg-muted/20">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-12">Digest</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead className="text-right w-20">Actions</TableHead>
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
    const namespaces = Object.keys(groupedRepositories).sort();

    if (namespaces.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>All Repositories</CardTitle>
            <CardDescription>Container images from all users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Container className="h-12 w-12 opacity-50" />
              <p className="mt-4">No images in registry</p>
              <p className="text-sm">
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
          <CardHeader>
            <CardTitle>All Repositories</CardTitle>
            <CardDescription>
              Container images grouped by user namespace
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {namespaces.map((namespace) => {
                const repos = groupedRepositories[namespace];
                const isExpanded = expandedNamespaces.has(namespace);
                const totalImages = repos.reduce(
                  (sum, r) => sum + r.imageCount,
                  0,
                );
                const totalTags = repos.reduce((sum, r) => sum + r.tagCount, 0);

                return (
                  <div key={namespace}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                      onClick={() => toggleNamespace(namespace)}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium font-mono">
                          {namespace}/
                        </span>
                        <Badge variant="secondary">
                          {repos.length}{" "}
                          {repos.length === 1 ? "repository" : "repositories"}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <Hash className="h-3 w-3" />
                          {totalImages} {totalImages === 1 ? "image" : "images"}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <Tag className="h-3 w-3" />
                          {totalTags} {totalTags === 1 ? "tag" : "tags"}
                        </Badge>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t bg-muted/10">
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
              <DialogDescription className="space-y-2">
                <div>
                  Are you sure you want to delete image{" "}
                  <code className="rounded bg-muted px-1">
                    {truncateDigest(deleteDialog.digest)}
                  </code>{" "}
                  from{" "}
                  <code className="rounded bg-muted px-1">
                    {deleteDialog.repository}
                  </code>
                  ?
                </div>
                {deleteDialog.tags.length > 0 && (
                  <div className="text-destructive">
                    This will remove {deleteDialog.tags.length} tag
                    {deleteDialog.tags.length > 1 ? "s" : ""}:{" "}
                    {deleteDialog.tags.join(", ")}
                  </div>
                )}
                <div className="font-medium">This action cannot be undone.</div>
              </DialogDescription>
            </DialogHeader>
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
      </>
    );
  }

  // Regular user view
  if (repositories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Repositories</CardTitle>
          <CardDescription>Container images in your namespace</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Container className="h-12 w-12 opacity-50" />
            <p className="mt-4">No images yet</p>
            <p className="text-sm">Push your first image to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Your Repositories</CardTitle>
          <CardDescription>Container images in your namespace</CardDescription>
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
            <DialogDescription className="space-y-2">
              <div>
                Are you sure you want to delete image{" "}
                <code className="rounded bg-muted px-1">
                  {truncateDigest(deleteDialog.digest)}
                </code>{" "}
                from{" "}
                <code className="rounded bg-muted px-1">
                  {deleteDialog.repository}
                </code>
                ?
              </div>
              {deleteDialog.tags.length > 0 && (
                <div className="text-destructive">
                  This will remove {deleteDialog.tags.length} tag
                  {deleteDialog.tags.length > 1 ? "s" : ""}:{" "}
                  {deleteDialog.tags.join(", ")}
                </div>
              )}
              <div className="font-medium">This action cannot be undone.</div>
            </DialogDescription>
          </DialogHeader>
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
    </>
  );
}
