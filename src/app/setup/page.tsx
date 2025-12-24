"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Container } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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

const setupSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(50, "Username must be at most 50 characters")
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Username can only contain letters, numbers, underscores, and hyphens",
      ),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password must be at most 100 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SetupInput = z.infer<typeof setupSchema>;

export default function SetupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SetupInput>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: SetupInput) => {
    setIsLoading(true);
    setError(null);
    setHint(null);

    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username,
          email: data.email,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Setup failed");
        if (result.hint) {
          setHint(result.hint);
        }
        return;
      }

      // Setup successful, redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Container className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Initial Setup</CardTitle>
          <CardDescription className="text-center">
            Create your administrator account to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/15 p-3 space-y-2">
                  <p className="text-sm text-destructive font-medium">
                    {error}
                  </p>
                  {hint && (
                    <p className="text-sm text-muted-foreground font-mono bg-background/50 p-2 rounded border">
                      {hint}
                    </p>
                  )}
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
                        {...field}
                        placeholder="admin"
                        disabled={isLoading}
                        autoComplete="username"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="admin@example.com"
                        disabled={isLoading}
                        autoComplete="email"
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
                        {...field}
                        type="password"
                        placeholder="••••••••"
                        disabled={isLoading}
                        autoComplete="new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="••••••••"
                        disabled={isLoading}
                        autoComplete="new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Create Admin Account"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
