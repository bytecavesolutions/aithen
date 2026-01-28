"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
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
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  type LoginMethodsSettingsInput,
  loginMethodsSettingsSchema,
} from "@/lib/validations";

interface OIDCStatus {
  enabled: boolean;
}

export function LoginMethodsSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [oidcEnabled, setOIDCEnabled] = useState(false);

  const form = useForm<LoginMethodsSettingsInput>({
    resolver: zodResolver(loginMethodsSettingsSchema),
    defaultValues: {
      passwordEnabled: true,
      passkeyEnabled: true,
      autoTrigger: "passkey",
    },
  });

  const passwordEnabled = form.watch("passwordEnabled");
  const passkeyEnabled = form.watch("passkeyEnabled");

  // Check if at least one method would remain enabled
  const wouldDisableAll = !passwordEnabled && !passkeyEnabled && !oidcEnabled;

  const fetchConfig = useCallback(async () => {
    try {
      const [configResponse, oidcResponse] = await Promise.all([
        fetch("/api/admin/settings/login-methods"),
        fetch("/api/auth/oidc/status"),
      ]);

      if (configResponse.ok) {
        const data = await configResponse.json();
        form.reset(data);
      }

      if (oidcResponse.ok) {
        const oidcData: OIDCStatus = await oidcResponse.json();
        setOIDCEnabled(oidcData.enabled);
      }
    } catch (err) {
      console.error("Failed to fetch login methods config:", err);
      setError("Failed to load login methods configuration");
    } finally {
      setIsLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function onSubmit(data: LoginMethodsSettingsInput) {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/settings/login-methods", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to save configuration");
        return;
      }

      setSuccess("Login methods configuration saved successfully");
    } catch (err) {
      console.error("Save error:", err);
      setError("Failed to save configuration");
    } finally {
      setIsSaving(false);
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
        <CardTitle>Login Methods</CardTitle>
        <CardDescription>
          Configure which authentication methods are available on the login page
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

            {wouldDisableAll && (
              <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  At least one login method must be enabled. Enable OIDC/SSO
                  below if you want to disable password and passkey login.
                </span>
              </div>
            )}

            <FormField
              control={form.control}
              name="passwordEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Enable Password Login
                    </FormLabel>
                    <FormDescription>
                      Allow users to sign in with username and password
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
              name="passkeyEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Enable Passkey Login
                    </FormLabel>
                    <FormDescription>
                      Allow users to sign in with passkeys (biometrics, security
                      keys)
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

            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <div className="text-base font-medium">OIDC/SSO</div>
                <p className="text-sm text-muted-foreground">
                  Configure in OIDC Settings below
                </p>
              </div>
              {oidcEnabled ? (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Enabled</span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Not configured</span>
              )}
            </div>

            <FormField
              control={form.control}
              name="autoTrigger"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auto-trigger on Login Page</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select auto-trigger behavior" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None - Show all options</SelectItem>
                      <SelectItem value="passkey" disabled={!passkeyEnabled}>
                        Passkey {passkeyEnabled ? "(Recommended)" : "(Disabled)"}
                      </SelectItem>
                      <SelectItem value="oidc" disabled={!oidcEnabled}>
                        OIDC/SSO {oidcEnabled ? "" : "(Not configured)"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Automatically prompt this authentication method when the
                    login page loads
                  </FormDescription>
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving || wouldDisableAll}>
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
