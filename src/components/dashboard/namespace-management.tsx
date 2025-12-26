"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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

const createNamespaceSchema = z.object({
  name: z
    .string()
    .min(3, "Namespace must be at least 3 characters")
    .max(50, "Namespace must be less than 50 characters")
    .regex(
      /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/,
      "Namespace must start and end with lowercase letter or number",
    ),
  userId: z.string().min(1, "User is required"),
  description: z.string().max(255).optional(),
});

type CreateNamespaceInput = z.infer<typeof createNamespaceSchema>;

interface Namespace {
  id: number;
  name: string;
  userId: number;
  description: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: number;
    username: string;
    email: string;
  };
}

interface User {
  id: number;
  username: string;
  email: string;
}

export function NamespaceManagement({
  namespaces,
  users,
  isAdmin,
}: {
  namespaces: Namespace[];
  users: User[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateNamespaceInput>({
    resolver: zodResolver(createNamespaceSchema),
    defaultValues: {
      name: "",
      userId: "",
      description: "",
    },
  });

  async function onSubmit(data: CreateNamespaceInput) {
    try {
      setError(null);

      const response = await fetch("/api/namespaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          userId: Number.parseInt(data.userId, 10),
          description: data.description || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create namespace");
      }

      setIsCreateOpen(false);
      form.reset();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create namespace",
      );
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this namespace?")) {
      return;
    }

    try {
      setIsDeleting(id);
      setError(null);

      const response = await fetch(`/api/namespaces/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete namespace");
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete namespace",
      );
    } finally {
      setIsDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Namespaces</h2>
          <p className="text-muted-foreground">
            Manage repository namespaces for users
          </p>
        </div>
        {isAdmin && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Namespace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Namespace</DialogTitle>
                <DialogDescription>
                  Create a new repository namespace for a user. The namespace
                  name must be lowercase.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Namespace Name</FormLabel>
                        <FormControl>
                          <Input placeholder="my-namespace" {...field} />
                        </FormControl>
                        <FormDescription>
                          Lowercase letters, numbers, underscores, and hyphens
                          only
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="userId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Owner</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a user" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users.map((user) => (
                              <SelectItem
                                key={user.id}
                                value={user.id.toString()}
                              >
                                {user.username} ({user.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          The user who owns this namespace
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Description..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {error && (
                    <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={form.formState.isSubmitting}
                    >
                      {form.formState.isSubmitting ? "Creating..." : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {error && !isCreateOpen && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Namespace</TableHead>
              {isAdmin && <TableHead>Owner</TableHead>}
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Created</TableHead>
              {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {namespaces.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 6 : 4}
                  className="text-center text-muted-foreground"
                >
                  No namespaces found
                </TableCell>
              </TableRow>
            ) : (
              namespaces.map((namespace) => (
                <TableRow key={namespace.id}>
                  <TableCell className="font-mono">{namespace.name}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      {namespace.user?.username || "Unknown"}
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground">
                    {namespace.description || "—"}
                  </TableCell>
                  <TableCell>
                    {namespace.isDefault ? (
                      <Badge variant="secondary">Default</Badge>
                    ) : (
                      <Badge variant="outline">Custom</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(namespace.createdAt).toLocaleDateString()}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(namespace.id)}
                        disabled={
                          namespace.isDefault || isDeleting === namespace.id
                        }
                        title={
                          namespace.isDefault
                            ? "Cannot delete default namespace"
                            : "Delete namespace"
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
