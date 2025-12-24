"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Container, Fingerprint, Key } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { loginSchema, type LoginInput } from "@/lib/validations";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [checkingPasskey, setCheckingPasskey] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);
  const [isAutoTrigger, setIsAutoTrigger] = useState(false);
  const autoTriggerInitiated = useRef(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const username = form.watch("username");

  // Auto-trigger passkey on page load (like Go implementation)
  useEffect(() => {
    // Prevent React Strict Mode from running this twice
    if (autoTriggerInitiated.current || hasAutoTriggered || isPasskeyLoading) {
      return;
    }

    autoTriggerInitiated.current = true;

    const autoTriggerPasskey = async () => {
      // Wait for page to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (hasAutoTriggered || isPasskeyLoading) return;
      
      try {
        console.log("🔐 Auto-triggering passkey authentication...");
        setHasAutoTriggered(true);
        setIsAutoTrigger(true);
        await handlePasskeyLogin();
      } catch (err) {
        // Silently ignore auto-trigger errors
      } finally {
        setIsAutoTrigger(false);
      }
    };

    autoTriggerPasskey();
  }, []);

  // Check if user has passkey when username is entered
  useEffect(() => {
    const checkPasskey = async () => {
      if (!username || username.length < 2) {
        setHasPasskey(false);
        return;
      }

      setCheckingPasskey(true);
      try {
        const response = await fetch("/api/auth/passkey/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });

        const data = await response.json();
        console.log("Passkey check result:", data);
        setHasPasskey(data.hasPasskey);

        // Auto-trigger passkey if available (only on first detection)
        if (data.hasPasskey && !showPasswordForm && !isPasskeyLoading) {
          console.log("Auto-triggering passkey login...");
          setTimeout(() => handlePasskeyLogin(), 500);
        }
      } catch (err) {
        console.error("Passkey check failed:", err);
        setHasPasskey(false);
      } finally {
        setCheckingPasskey(false);
      }
    };

    const timer = setTimeout(checkPasskey, 300);
    return () => clearTimeout(timer);
  }, [username]);

  async function handlePasskeyLogin() {
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
        throw new Error(errorData.details || "Failed to get authentication options");
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
      // Silently ignore errors from auto-triggered attempts
      if (isAutoTrigger) {
        // Don't log or show anything for auto-triggered attempts
        return;
      }
      
      // Show errors for manual attempts
      console.error("Passkey login error:", err);
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Passkey authentication was cancelled"
          : err instanceof Error && err.name === "AbortError"
          ? "Passkey authentication was aborted"
          : "Passkey authentication failed. Try password login instead.",
      );
    } finally {
      setIsPasskeyLoading(false);
    }
  }

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

              {/* Always visible passkey login button */}
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
                    {checkingPasskey && (
                      <p className="text-xs text-muted-foreground">
                        Checking for passkey...
                      </p>
                    )}
                    {hasPasskey && !showPasswordForm && (
                      <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                        <Fingerprint className="h-3 w-3" />
                        <span>Passkey detected for this account</span>
                      </div>
                    )}
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
