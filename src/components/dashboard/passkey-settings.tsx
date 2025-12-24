"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Passkey {
  id: string;
  deviceName: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export function PasskeySettings() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPasskeys = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/passkey/list");
      if (response.ok) {
        const data = await response.json();
        setPasskeys(data.passkeys);
      }
    } catch (err) {
      console.error("Failed to fetch passkeys:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPasskeys();
  }, [fetchPasskeys]);

  async function handleRegisterPasskey() {
    setIsRegistering(true);
    setError(null);
    setSuccess(null);

    try {
      // Get registration options from server
      const optionsResponse = await fetch("/api/auth/passkey/register/options");

      if (!optionsResponse.ok) {
        const errorData = await optionsResponse.json();
        throw new Error(
          errorData.details ||
            errorData.error ||
            "Failed to get registration options",
        );
      }

      const options = await optionsResponse.json();

      // Start registration with the browser
      const registrationResponse = await startRegistration(options);

      // Verify registration with server
      const verifyResponse = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registrationResponse),
      });

      const result = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(result.error || "Registration failed");
      }

      setSuccess("Passkey registered successfully!");
      await fetchPasskeys(); // Refresh the list
    } catch (err) {
      console.error("Passkey registration error:", err);

      // Provide user-friendly error messages
      let errorMessage = "Failed to register passkey. Please try again.";

      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          errorMessage =
            "Passkey registration was canceled or timed out. Please try again and complete the authentication prompt.";
        } else if (err.name === "InvalidStateError") {
          errorMessage = "This passkey is already registered on this device.";
        } else if (err.name === "SecurityError") {
          errorMessage =
            "Security error: Passkeys require HTTPS. Make sure you're using a secure connection.";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleDeletePasskey(passkeyId: string) {
    if (!confirm("Are you sure you want to delete this passkey?")) {
      return;
    }

    try {
      const response = await fetch("/api/auth/passkey/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passkeyId }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete passkey");
      }

      setSuccess("Passkey deleted successfully!");
      await fetchPasskeys(); // Refresh the list
    } catch (err) {
      console.error("Delete passkey error:", err);
      setError("Failed to delete passkey. Please try again.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Passkey Authentication</CardTitle>
        <CardDescription>
          Add a passkey for faster, passwordless login using biometric
          authentication or your device's screen lock.
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
              <Fingerprint className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">What are passkeys?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Passkeys use your device's biometric authentication
                  (fingerprint, face ID) or screen lock to sign you in securely
                  without a password.
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleRegisterPasskey}
            disabled={isRegistering}
            className="w-full sm:w-auto"
          >
            {isRegistering ? (
              "Registering..."
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Passkey
              </>
            )}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading passkeys...</p>
        ) : passkeys.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Your Passkeys</h3>
              <span className="text-xs text-muted-foreground">
                {passkeys.length}{" "}
                {passkeys.length === 1 ? "passkey" : "passkeys"}
              </span>
            </div>
            <div className="space-y-2">
              {passkeys.map((passkey) => (
                <div
                  key={passkey.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Fingerprint className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {passkey.deviceName || "Unnamed Passkey"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created{" "}
                        {new Date(passkey.createdAt).toLocaleDateString()}
                        {passkey.lastUsedAt && (
                          <>
                            {" • "}Last used{" "}
                            {new Date(passkey.lastUsedAt).toLocaleDateString()}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeletePasskey(passkey.id)}
                    className="hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No passkeys registered yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
