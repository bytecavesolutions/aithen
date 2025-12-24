import { Fingerprint, KeyRound } from "lucide-react";
import { ChangePassword } from "@/components/dashboard/change-password";
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
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="security" className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="passkeys" className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4" />
            Passkeys
          </TabsTrigger>
        </TabsList>

        <TabsContent value="security" className="space-y-4">
          <ChangePassword />
        </TabsContent>

        <TabsContent value="passkeys" className="space-y-4">
          <PasskeySettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
