"use client";

import { Check, Copy, Download, Key, Plus, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Namespace {
  id: number;
  name: string;
}

interface AccessToken {
  id: string;
  name: string;
  permissions: string;
  namespaceId: number | null;
  namespace: Namespace | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
}

interface CreatedToken {
  id: string;
  name: string;
  rawToken: string;
  expiresAt: Date | null;
}

export function AccessTokenSettings() {
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    "pull",
  ]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>("global");
  const [expiresInDays, setExpiresInDays] = useState<string>("never");
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [isLoadingNamespaces, setIsLoadingNamespaces] = useState(false);

  // Created token display
  const [createdToken, setCreatedToken] = useState<CreatedToken | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchTokens = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/access-tokens");
      if (response.ok) {
        const data = await response.json();
        setTokens(data.tokens);
      }
    } catch (err) {
      console.error("Failed to fetch access tokens:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchNamespaces = useCallback(async () => {
    setIsLoadingNamespaces(true);
    try {
      const response = await fetch("/api/namespaces");
      if (response.ok) {
        const data = await response.json();
        setNamespaces(data.namespaces || []);
      }
    } catch (err) {
      console.error("Failed to fetch namespaces:", err);
    } finally {
      setIsLoadingNamespaces(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  async function handleCreateToken() {
    if (!newTokenName.trim()) {
      setError("Token name is required");
      return;
    }

    if (selectedPermissions.length === 0) {
      setError("At least one permission is required");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const body: {
        name: string;
        permissions: string[];
        expiresInDays?: number;
        namespaceId?: number;
      } = {
        name: newTokenName.trim(),
        permissions: selectedPermissions,
        expiresInDays:
          expiresInDays === "never" ? undefined : Number(expiresInDays),
      };

      // Only add namespaceId if a specific namespace is selected (not global)
      if (selectedNamespace !== "global") {
        body.namespaceId = Number(selectedNamespace);
      }

      const response = await fetch("/api/auth/access-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create token");
      }

      setCreatedToken(result.token);
      setNewTokenName("");
      setSelectedPermissions(["pull"]);
      setSelectedNamespace("global");
      setExpiresInDays("never");
      await fetchTokens();
    } catch (err) {
      console.error("Create token error:", err);
      setError(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteToken(tokenId: string) {
    if (
      !confirm(
        "Are you sure you want to delete this access token? Any applications using this token will lose access.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/auth/access-tokens/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete token");
      }

      setSuccess("Access token deleted successfully!");
      await fetchTokens();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Delete token error:", err);
      setError("Failed to delete token. Please try again.");
    }
  }

  function handleCopyToken() {
    if (createdToken) {
      navigator.clipboard.writeText(createdToken.rawToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleDialogClose() {
    setIsCreateOpen(false);
    setCreatedToken(null);
    setNewTokenName("");
    setSelectedPermissions(["pull"]);
    setSelectedNamespace("global");
    setExpiresInDays("never");
    setError(null);
    setCopied(false);
  }

  function getExpiryStatus(expiresAt: Date | null): {
    text: string;
    isExpired: boolean;
  } {
    if (!expiresAt) {
      return { text: "Never expires", isExpired: false };
    }

    const now = new Date();
    const expiry = new Date(expiresAt);

    if (expiry < now) {
      return { text: "Expired", isExpired: true };
    }

    const daysUntilExpiry = Math.ceil(
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilExpiry === 0) {
      return { text: "Expires today", isExpired: false };
    }
    if (daysUntilExpiry === 1) {
      return { text: "Expires tomorrow", isExpired: false };
    }

    return { text: `Expires in ${daysUntilExpiry} days`, isExpired: false };
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Access Tokens</CardTitle>
        <CardDescription>
          Create personal access tokens to authenticate with the API. Tokens are
          shown only once when created.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
            {success}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-start gap-3">
              <Key className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">What are access tokens?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Access tokens allow external applications to authenticate with
                  the API on your behalf. Keep your tokens secure and never
                  share them publicly.
                </p>
              </div>
            </div>
          </div>

          <Dialog
            open={isCreateOpen}
            onOpenChange={(open) => {
              if (!open) {
                handleDialogClose();
              } else {
                setIsCreateOpen(true);
                fetchNamespaces();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Create Token
              </Button>
            </DialogTrigger>
            <DialogContent>
              {createdToken ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Token Created Successfully</DialogTitle>
                    <DialogDescription>
                      Make sure to copy your access token now. You won't be able
                      to see it again!
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Your new access token</Label>
                      <div className="flex gap-2">
                        <Input
                          value={createdToken.rawToken}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleCopyToken}
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This token grants access to your account. Keep it
                        secure.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleDialogClose}>Done</Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Create Access Token</DialogTitle>
                    <DialogDescription>
                      Generate a new personal access token for API
                      authentication.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="token-name">Token Name</Label>
                      <Input
                        id="token-name"
                        placeholder="e.g., CI/CD Pipeline, Development"
                        value={newTokenName}
                        onChange={(e) => setNewTokenName(e.target.value)}
                        disabled={isCreating}
                      />
                      <p className="text-xs text-muted-foreground">
                        Give your token a descriptive name to remember its
                        purpose.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <Label>Permissions</Label>
                      <div className="grid gap-3">
                        {[
                          {
                            value: "pull",
                            label: "Pull",
                            description: "Download images from the registry",
                            icon: Download,
                          },
                          {
                            value: "push",
                            label: "Push",
                            description: "Upload images to the registry",
                            icon: Upload,
                          },
                          {
                            value: "delete",
                            label: "Delete",
                            description: "Remove images from the registry",
                            icon: Trash2,
                          },
                        ].map((permission) => {
                          const Icon = permission.icon;
                          const isChecked = selectedPermissions.includes(
                            permission.value,
                          );
                          return (
                            <label
                              key={permission.value}
                              htmlFor={`permission-${permission.value}`}
                              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                                isChecked
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:bg-accent"
                              } ${isCreating ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <input
                                type="checkbox"
                                id={`permission-${permission.value}`}
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPermissions([
                                      ...selectedPermissions,
                                      permission.value,
                                    ]);
                                  } else {
                                    setSelectedPermissions(
                                      selectedPermissions.filter(
                                        (p) => p !== permission.value,
                                      ),
                                    );
                                  }
                                }}
                                disabled={isCreating}
                                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
                              />
                              <div className="flex items-start gap-3 flex-1">
                                <div
                                  className={`rounded-md p-1.5 ${
                                    isChecked
                                      ? "bg-primary/10 text-primary"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium text-sm">
                                    {permission.label}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {permission.description}
                                  </div>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Select the permissions this token should have. At least
                        one is required.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="namespace">Namespace (Optional)</Label>
                      <Select
                        value={selectedNamespace}
                        onValueChange={setSelectedNamespace}
                        disabled={isCreating || isLoadingNamespaces}
                      >
                        <SelectTrigger id="namespace">
                          <SelectValue
                            placeholder={
                              isLoadingNamespaces
                                ? "Loading namespaces..."
                                : "All namespaces (global token)"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="global">
                            All namespaces (global token)
                          </SelectItem>
                          {namespaces.map((ns) => (
                            <SelectItem key={ns.id} value={String(ns.id)}>
                              {ns.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Select a namespace to restrict this token to only that
                        namespace. Select "All namespaces" for global access to
                        all your namespaces.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expires">Expiration</Label>
                      <Select
                        value={expiresInDays}
                        onValueChange={setExpiresInDays}
                        disabled={isCreating}
                      >
                        <SelectTrigger id="expires">
                          <SelectValue placeholder="Select expiration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="180">180 days</SelectItem>
                          <SelectItem value="365">1 year</SelectItem>
                          <SelectItem value="never">Never</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={handleDialogClose}
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreateToken} disabled={isCreating}>
                      {isCreating ? "Creating..." : "Create Token"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading tokens...</p>
        ) : tokens.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Your Access Tokens</h3>
              <span className="text-xs text-muted-foreground">
                {tokens.length} {tokens.length === 1 ? "token" : "tokens"}
              </span>
            </div>
            <div className="space-y-2">
              {tokens.map((token) => {
                const expiry = getExpiryStatus(token.expiresAt);
                return (
                  <div
                    key={token.id}
                    className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-primary/10 p-2">
                        <Key className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{token.name}</p>
                          <div className="flex items-center gap-1">
                            {token.permissions.split(",").map((permission) => {
                              const permissionConfig = {
                                pull: {
                                  icon: Download,
                                  variant: "secondary" as const,
                                },
                                push: {
                                  icon: Upload,
                                  variant: "default" as const,
                                },
                                delete: {
                                  icon: Trash2,
                                  variant: "outline" as const,
                                },
                              }[permission];

                              if (!permissionConfig) return null;

                              const PermIcon = permissionConfig.icon;
                              return (
                                <Badge
                                  key={permission}
                                  variant={permissionConfig.variant}
                                  className="gap-1"
                                >
                                  <PermIcon className="h-3 w-3" />
                                  {permission.charAt(0).toUpperCase() +
                                    permission.slice(1)}
                                </Badge>
                              );
                            })}
                            {token.namespace && (
                              <Badge variant="outline" className="gap-1 ml-1">
                                <span className="text-xs">
                                  NS: {token.namespace.name}
                                </span>
                              </Badge>
                            )}
                            {!token.namespace && (
                              <Badge variant="outline" className="gap-1 ml-1">
                                <span className="text-xs">Global</span>
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created{" "}
                          {new Date(token.createdAt).toLocaleDateString()}
                          {token.lastUsedAt && (
                            <>
                              {" • "}Last used{" "}
                              {new Date(token.lastUsedAt).toLocaleDateString()}
                            </>
                          )}
                          {" • "}
                          <span
                            className={
                              expiry.isExpired ? "text-destructive" : ""
                            }
                          >
                            {expiry.text}
                          </span>
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteToken(token.id)}
                      className="hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No access tokens created yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
