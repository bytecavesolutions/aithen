"use client";

import { Link2, Loader2, LogIn, Unlink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface OAuthAccount {
  id: string;
  provider: string;
  providerUsername: string | null;
  email: string | null;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

export function OAuthAccounts() {
  const [accounts, setAccounts] = useState<OAuthAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [oidcEnabled, setOIDCEnabled] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/oauth/accounts");
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts);
      }
    } catch (err) {
      console.error("Failed to fetch OAuth accounts:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();

    // Check if OIDC is enabled
    async function checkOIDCStatus() {
      try {
        const response = await fetch("/api/auth/oidc/status");
        if (response.ok) {
          const data = await response.json();
          setOIDCEnabled(data.enabled);
        }
      } catch (err) {
        console.error("Failed to check OIDC status:", err);
      }
    }
    checkOIDCStatus();
  }, [fetchAccounts]);

  async function handleUnlink(accountId: string) {
    if (!confirm("Are you sure you want to unlink this account?")) {
      return;
    }

    setIsDeleting(accountId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/auth/oauth/accounts/${accountId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to unlink account");
        return;
      }

      setSuccess("Account unlinked successfully");
      await fetchAccounts();
    } catch (err) {
      console.error("Unlink error:", err);
      setError("Failed to unlink account");
    } finally {
      setIsDeleting(null);
    }
  }

  function handleLinkOIDC() {
    // Redirect to OIDC authorize endpoint
    window.location.href = "/api/auth/oidc/authorize";
  }

  const PROVIDER_NAMES: Record<string, string> = { oidc: "SSO / OIDC" };
  const getProviderDisplayName = (provider: string) =>
    PROVIDER_NAMES[provider] ?? provider;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Accounts</CardTitle>
        <CardDescription>
          Manage external accounts linked to your profile for single sign-on
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
              <Link2 className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  What are connected accounts?
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Connected accounts allow you to sign in using your
                  organization's identity provider (like Google Workspace, Azure
                  AD, or Okta) instead of a password.
                </p>
              </div>
            </div>
          </div>

          {oidcEnabled && accounts.length === 0 && (
            <Button onClick={handleLinkOIDC} className="w-full sm:w-auto">
              <LogIn className="mr-2 h-4 w-4" />
              Link SSO Account
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Your Connected Accounts</h3>
              <span className="text-xs text-muted-foreground">
                {accounts.length}{" "}
                {accounts.length === 1 ? "account" : "accounts"}
              </span>
            </div>
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Link2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {getProviderDisplayName(account.provider)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {account.providerUsername ||
                          account.email ||
                          "Connected"}
                        {account.name && ` (${account.name})`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Linked{" "}
                        {new Date(account.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleUnlink(account.id)}
                    disabled={isDeleting === account.id}
                    className="hover:bg-destructive/10 hover:text-destructive"
                  >
                    {isDeleting === account.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {oidcEnabled
              ? "No connected accounts. Click the button above to link your SSO account."
              : "No connected accounts. SSO is not currently enabled by your administrator."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
