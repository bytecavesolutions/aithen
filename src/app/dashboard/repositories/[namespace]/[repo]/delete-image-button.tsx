"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DeleteImageButtonProps {
  repository: string;
  digest: string;
  tags: string[];
}

function truncateDigest(digest: string): string {
  if (!digest) return "";
  const hash = digest.replace("sha256:", "");
  return hash.substring(0, 12);
}

export function DeleteImageButton({
  repository,
  digest,
  tags,
}: DeleteImageButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch("/api/registry/images/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repository, digest }),
      });

      if (response.ok) {
        router.refresh();
        setOpen(false);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete image");
      }
    } catch (error) {
      alert(
        `Failed to delete image: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-destructive opacity-0 group-hover:opacity-100 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Image</DialogTitle>
          <DialogDescription className="space-y-2">
            <div>
              Are you sure you want to delete image{" "}
              <code className="rounded bg-muted px-1">
                {truncateDigest(digest)}
              </code>{" "}
              from <code className="rounded bg-muted px-1">{repository}</code>?
            </div>
            {tags.length > 0 && (
              <div className="text-destructive">
                This will remove {tags.length} tag
                {tags.length > 1 ? "s" : ""}: {tags.join(", ")}
              </div>
            )}
            <div className="font-medium">This action cannot be undone.</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
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
  );
}
