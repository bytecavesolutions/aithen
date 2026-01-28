"use client";

import { Fingerprint, Key, KeyRound, Link2 } from "lucide-react";
import { AccessTokenSettings } from "@/components/dashboard/access-token-settings";
import { ChangePassword } from "@/components/dashboard/change-password";
import { OAuthAccounts } from "@/components/dashboard/oauth-accounts";
import { PasskeySettings } from "@/components/dashboard/passkey-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      <Tabs defaultValue="security" className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="security" className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="tokens" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">Tokens</span>
          </TabsTrigger>
          <TabsTrigger value="passkeys" className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4" />
            <span className="hidden sm:inline">Passkeys</span>
          </TabsTrigger>
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">Accounts</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="security" className="space-y-4">
          <ChangePassword />
        </TabsContent>

        <TabsContent value="tokens" className="space-y-4">
          <AccessTokenSettings />
        </TabsContent>

        <TabsContent value="passkeys" className="space-y-4">
          <PasskeySettings />
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          <OAuthAccounts />
        </TabsContent>
      </Tabs>
    </div>
  );
}
