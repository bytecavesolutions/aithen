"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startAuthentication } from "@simplewebauthn/browser";
import { Container, Fingerprint, Key, LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { type LoginInput, loginSchema } from "@/lib/validations";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Container className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Registry Hub</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [isOIDCLoading, setIsOIDCLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);
  const [isAutoTrigger, setIsAutoTrigger] = useState(false);
  const [oidcEnabled, setOIDCEnabled] = useState(false);
  const autoTriggerInitiated = useRef(false);

  // Check for error in URL params (from OIDC callback)
  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) {
      setError(urlError);
      // Clear the error from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  // Check if OIDC is enabled
  useEffect(() => {
    async function checkOIDCStatus() {
      try {
        const response = await fetch("/api/auth/oidc/status");
        const data = await response.json();
        console.log("OIDC status response:", data);
        if (response.ok && data.enabled) {
          setOIDCEnabled(true);
        }
      } catch (err) {
        console.error("Failed to check OIDC status:", err);
      }
    }
    checkOIDCStatus();
  }, []);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const handlePasskeyLogin = useCallback(async () => {
    if (isPasskeyLoading) {
      console.log("Passkey login already in progress, skipping...");
      return;
    }

    console.log("🔐 Starting passkey login...");
    setIsPasskeyLoading(true);
    setError(null);

    try {
      // Get authentication options (no username needed for discoverable credentials)
      console.log("Fetching authentication options...");
      const optionsResponse = await fetch("/api/auth/passkey/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      console.log("Options response status:", optionsResponse.status);

      if (!optionsResponse.ok) {
        const errorData = await optionsResponse.json();
        console.error("Options error:", errorData);
        throw new Error(
          errorData.details || "Failed to get authentication options",
        );
      }

      const options = await optionsResponse.json();
      console.log("✅ Options received:", options);

      // Start authentication with the browser
      const authResponse = await startAuthentication({ optionsJSON: options });

      // Verify authentication
      const verifyResponse = await fetch("/api/auth/passkey/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authResponse),
      });

      const result = await verifyResponse.json();

      if (!verifyResponse.ok) {
        setError(result.error || "Passkey authentication failed");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      // Handle cancellation and abort errors
      const isCancelled =
        err instanceof Error &&
        (err.name === "NotAllowedError" || err.name === "AbortError");

      // Silently ignore cancellations from auto-triggered attempts
      if (isAutoTrigger) {
        // Don't log or show anything for auto-triggered attempts
        if (!isCancelled) {
          console.log(
            "Auto-trigger passkey failed:",
            err instanceof Error ? err.message : err,
          );
        }
        return;
      }

      // For manual attempts, only log non-cancellation errors
      if (!isCancelled) {
        console.error("Passkey login error:", err);
      }

      // Show user-friendly error messages
      if (isCancelled) {
        // Don't show error for cancellations - user knows they cancelled
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Passkey authentication failed. Try password login instead.",
      );
    } finally {
      setIsPasskeyLoading(false);
    }
  }, [isPasskeyLoading, isAutoTrigger, router]);

  // Auto-trigger passkey on page load (like Go implementation)
  useEffect(() => {
    // Prevent React Strict Mode from running this twice
    if (autoTriggerInitiated.current || hasAutoTriggered || isPasskeyLoading) {
      return;
    }

    autoTriggerInitiated.current = true;

    const autoTriggerPasskey = async () => {
      // Wait for page to settle
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (hasAutoTriggered || isPasskeyLoading) return;

      try {
        console.log("🔐 Auto-triggering passkey authentication...");
        setHasAutoTriggered(true);
        setIsAutoTrigger(true);
        await handlePasskeyLogin();
      } catch (_err) {
        // Silently ignore auto-trigger errors
      } finally {
        setIsAutoTrigger(false);
      }
    };

    autoTriggerPasskey();
  }, [handlePasskeyLogin, hasAutoTriggered, isPasskeyLoading]);

  async function onSubmit(data: LoginInput) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Login failed");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  function handleOIDCLogin() {
    setIsOIDCLoading(true);
    setError(null);
    // Redirect to OIDC authorize endpoint
    window.location.href = "/api/auth/oidc/authorize";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Container className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Registry Hub</CardTitle>
          <CardDescription>
            Sign in to manage your Docker registry
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* SSO login button (shown only if OIDC is enabled) */}
              {!showPasswordForm && oidcEnabled && (
                <Button
                  type="button"
                  onClick={handleOIDCLogin}
                  className="w-full"
                  disabled={isOIDCLoading}
                >
                  {isOIDCLoading ? (
                    "Redirecting..."
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign in with SSO
                    </>
                  )}
                </Button>
              )}

              {/* Passkey login button */}
              {!showPasswordForm && (
                <Button
                  type="button"
                  onClick={handlePasskeyLogin}
                  variant="outline"
                  className="w-full"
                  disabled={isPasskeyLoading}
                >
                  {isPasskeyLoading ? (
                    "Authenticating..."
                  ) : (
                    <>
                      <Fingerprint className="mr-2 h-4 w-4" />
                      Sign in with Passkey
                    </>
                  )}
                </Button>
              )}

              {!showPasswordForm && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your username"
                        autoComplete="username webauthn"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!showPasswordForm ? (
                <>
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign in with Password"}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setError(null);
                  }}
                  className="w-full"
                >
                  <Key className="mr-2 h-4 w-4" />
                  Back to login
                </Button>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
