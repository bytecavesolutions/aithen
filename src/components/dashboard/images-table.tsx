"use client";

import {
  ChevronDown,
  ChevronRight,
  Container,
  Trash2,
  User,
} from "lucide-react";
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

interface UserRepository {
  name: string;
  namespace: string;
  fullName: string;
  tags: string[];
  imageCount: number;
}

interface ImagesTableProps {
  repositories?: UserRepository[];
  groupedRepositories?: Record<string, UserRepository[]>;
  isAdmin: boolean;
}

export function ImagesTable({
  repositories = [],
  groupedRepositories,
  isAdmin,
}: ImagesTableProps) {
  const [expandedNamespaces, setExpandedNamespaces] = useState<Set<string>>(
    new Set(),
  );
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    repository: string;
    tag: string;
  }>({ open: false, repository: "", tag: "" });
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

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      console.log(`[ImagesTable] Deleting ${deleteDialog.repository}:${deleteDialog.tag}`);
      const response = await fetch("/api/registry/images/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository: deleteDialog.repository,
          tag: deleteDialog.tag,
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
      alert(`Failed to delete image: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDeleting(false);
      setDeleteDialog({ open: false, repository: "", tag: "" });
    }
  };

  const renderRepositoryRow = (repo: UserRepository, showNamespace = false) => (
    <TableRow key={repo.fullName}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <Container className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono">
            {showNamespace ? repo.fullName : repo.name}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {repo.tags.slice(0, 5).map((tag) => (
            <Badge key={tag} variant="secondary" className="font-mono text-xs">
              {tag}
            </Badge>
          ))}
          {repo.tags.length > 5 && (
            <Badge variant="outline" className="text-xs">
              +{repo.tags.length - 5} more
            </Badge>
          )}
          {repo.tags.length === 0 && (
            <span className="text-muted-foreground text-sm">No tags</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">{repo.imageCount}</TableCell>
      <TableCell className="text-right">
        {repo.tags.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive"
            onClick={() =>
              setDeleteDialog({
                open: true,
                repository: repo.fullName,
                tag: repo.tags[0],
              })
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );

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
          <CardContent>
            <div className="space-y-4">
              {namespaces.map((namespace) => {
                const repos = groupedRepositories[namespace];
                const isExpanded = expandedNamespaces.has(namespace);
                const totalImages = repos.reduce(
                  (sum, r) => sum + r.imageCount,
                  0,
                );

                return (
                  <div key={namespace} className="rounded-lg border">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between p-4 hover:bg-muted/50"
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
                          {repos.length} repositories
                        </Badge>
                        <Badge variant="outline">{totalImages} images</Badge>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Repository</TableHead>
                              <TableHead>Tags</TableHead>
                              <TableHead className="text-right">
                                Images
                              </TableHead>
                              <TableHead className="text-right w-20">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {repos.map((repo) => renderRepositoryRow(repo))}
                          </TableBody>
                        </Table>
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
                Are you sure you want to delete{" "}
                <code className="rounded bg-muted px-1">
                  {deleteDialog.repository}:{deleteDialog.tag}
                </code>
                ? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  setDeleteDialog({ open: false, repository: "", tag: "" })
                }
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
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
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Repository</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Images</TableHead>
                <TableHead className="text-right w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repositories.map((repo) => renderRepositoryRow(repo, true))}
            </TableBody>
          </Table>
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
              Are you sure you want to delete{" "}
              <code className="rounded bg-muted px-1">
                {deleteDialog.repository}:{deleteDialog.tag}
              </code>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDeleteDialog({ open: false, repository: "", tag: "" })
              }
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
