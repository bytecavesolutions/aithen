"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { type OIDCSettingsInput, oidcSettingsSchema } from "@/lib/validations";

interface TestResult {
  success: boolean;
  message: string;
  endpoints?: {
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint?: string;
    jwks_uri: string;
    issuer: string;
  };
}

export function OIDCSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const form = useForm<OIDCSettingsInput>({
    resolver: zodResolver(oidcSettingsSchema),
    defaultValues: {
      enabled: false,
      issuerUrl: "",
      clientId: "",
      clientSecret: "",
      usernameClaim: "preferred_username",
      autoCreateUsers: false,
      defaultRole: "user",
    },
  });

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/settings/oidc");
      if (response.ok) {
        const data = await response.json();
        form.reset(data);
      }
    } catch (err) {
      console.error("Failed to fetch OIDC config:", err);
      setError("Failed to load OIDC configuration");
    } finally {
      setIsLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function onSubmit(data: OIDCSettingsInput) {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/settings/oidc", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.details?.fieldErrors) {
          const errors = Object.values(result.details.fieldErrors).flat();
          setError(errors.join(", "));
        } else {
          setError(result.error || "Failed to save configuration");
        }
        return;
      }

      setSuccess("OIDC configuration saved successfully");
      // Refresh to get masked secret
      await fetchConfig();
    } catch (err) {
      console.error("Save error:", err);
      setError("Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  }

  async function testConnection() {
    const issuerUrl = form.getValues("issuerUrl");

    if (!issuerUrl) {
      setTestResult({
        success: false,
        message: "Please enter an Issuer URL first",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/admin/settings/oidc/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issuerUrl }),
      });

      const result = await response.json();

      if (!response.ok) {
        setTestResult({
          success: false,
          message: result.details || result.error || "Discovery failed",
        });
        return;
      }

      setTestResult({
        success: true,
        message: "Successfully connected to OIDC provider",
        endpoints: result.endpoints,
      });
    } catch (err) {
      console.error("Test error:", err);
      setTestResult({
        success: false,
        message: "Failed to connect to OIDC provider",
      });
    } finally {
      setIsTesting(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>OIDC / SSO Configuration</CardTitle>
        <CardDescription>
          Configure OpenID Connect authentication to allow users to sign in with
          your identity provider (Google, Azure AD, Okta, Keycloak, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Enable OIDC</FormLabel>
                    <FormDescription>
                      Allow users to sign in with your OIDC provider
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="issuerUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issuer URL</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          placeholder="https://accounts.google.com"
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={testConnection}
                        disabled={isTesting}
                      >
                        {isTesting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Test"
                        )}
                      </Button>
                    </div>
                    <FormDescription>
                      The OIDC provider's issuer URL (e.g.,
                      https://accounts.google.com)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {testResult && (
                <div
                  className={`rounded-md p-3 text-sm ${
                    testResult.success
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    {testResult.message}
                  </div>
                  {testResult.endpoints && (
                    <div className="mt-2 text-xs opacity-75">
                      <p>Issuer: {testResult.endpoints.issuer}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client ID</FormLabel>
                      <FormControl>
                        <Input placeholder="your-client-id" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Secret</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="your-client-secret"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="usernameClaim"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username Claim</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a claim" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="preferred_username">
                          preferred_username
                        </SelectItem>
                        <SelectItem value="email">email</SelectItem>
                        <SelectItem value="sub">sub (unique ID)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The OIDC claim to use for matching/creating usernames
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="font-medium">User Provisioning</h4>

              <FormField
                control={form.control}
                name="autoCreateUsers"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Auto-create users</FormLabel>
                      <FormDescription>
                        Automatically create new users when they sign in via
                        OIDC
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="defaultRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default role for new users</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The role assigned to auto-created users
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Configuration"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
