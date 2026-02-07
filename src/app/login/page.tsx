"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startAuthentication } from "@simplewebauthn/browser";
import { Container, Fingerprint, LogIn } from "lucide-react";
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

interface LoginMethodsStatus {
  passwordEnabled: boolean;
  passkeyEnabled: boolean;
  oidcEnabled: boolean;
  autoTrigger: "none" | "passkey" | "oidc";
}

// sessionStorage key to track if OIDC auto-trigger has been attempted this session
const OIDC_AUTO_TRIGGER_KEY = "oidc_auto_triggered";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [isOIDCLoading, setIsOIDCLoading] = useState(false);
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);
  const [isAutoTrigger, setIsAutoTrigger] = useState(false);
  const [loginMethods, setLoginMethods] = useState<LoginMethodsStatus | null>(
    null,
  );
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

  // Fetch login methods status
  useEffect(() => {
    async function fetchLoginMethodsStatus() {
      try {
        const response = await fetch("/api/auth/login-methods/status");
        if (response.ok) {
          const data: LoginMethodsStatus = await response.json();
          setLoginMethods(data);
        }
      } catch {
        // Fallback to defaults if fetch fails
        setLoginMethods({
          passwordEnabled: true,
          passkeyEnabled: true,
          oidcEnabled: false,
          autoTrigger: "passkey",
        });
      }
    }
    fetchLoginMethodsStatus();
  }, []);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const handlePasskeyLogin = useCallback(async () => {
    if (isPasskeyLoading) return;

    setIsPasskeyLoading(true);
    setError(null);

    try {
      const optionsResponse = await fetch("/api/auth/passkey/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!optionsResponse.ok) {
        const errorData = await optionsResponse.json();
        throw new Error(
          errorData.details || "Failed to get authentication options",
        );
      }

      const options = await optionsResponse.json();
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
      const isCancelled =
        err instanceof Error &&
        (err.name === "NotAllowedError" || err.name === "AbortError");

      // Silently ignore cancellations - user knows they cancelled
      if (isCancelled) {
        return;
      }

      // For auto-triggered attempts, don't show UI errors
      if (isAutoTrigger) {
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

  // Auto-trigger based on settings
  useEffect(() => {
    // Wait for login methods to load
    if (!loginMethods) return;

    // Prevent React Strict Mode from running this twice
    if (autoTriggerInitiated.current || hasAutoTriggered || isPasskeyLoading) {
      return;
    }

    // No auto-trigger if setting is "none"
    if (loginMethods.autoTrigger === "none") {
      return;
    }

    // Skip auto-trigger if user came from error or logout (prevents redirect loop)
    if (searchParams.get("error") || searchParams.get("logout")) {
      return;
    }

    autoTriggerInitiated.current = true;

    // OIDC auto-trigger - redirect immediately without delay
    if (loginMethods.autoTrigger === "oidc" && loginMethods.oidcEnabled) {
      // Skip if already attempted this session (prevents loop when provider silently redirects back)
      if (sessionStorage.getItem(OIDC_AUTO_TRIGGER_KEY)) {
        return;
      }

      // Mark as attempted before redirecting
      sessionStorage.setItem(OIDC_AUTO_TRIGGER_KEY, "true");
      setHasAutoTriggered(true);
      window.location.href = "/api/auth/oidc/authorize";
      return;
    }

    // Passkey auto-trigger - delay to let page settle
    if (loginMethods.autoTrigger === "passkey" && loginMethods.passkeyEnabled) {
      const performAutoTrigger = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (hasAutoTriggered || isPasskeyLoading) return;

        setHasAutoTriggered(true);
        setIsAutoTrigger(true);
        try {
          await handlePasskeyLogin();
        } finally {
          setIsAutoTrigger(false);
        }
      };
      performAutoTrigger();
    }
  }, [
    handlePasskeyLogin,
    hasAutoTriggered,
    isPasskeyLoading,
    loginMethods,
    searchParams,
  ]);

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
              {loginMethods?.oidcEnabled && (
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
              {loginMethods?.passkeyEnabled && (
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

              {/* Divider - shown when password is enabled and other methods are also available */}
              {loginMethods?.passwordEnabled &&
                (loginMethods?.oidcEnabled || loginMethods?.passkeyEnabled) && (
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

              {/* Password login form - shown when password login is enabled */}
              {loginMethods?.passwordEnabled && (
                <>
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
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
