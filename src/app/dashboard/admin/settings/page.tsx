import { redirect } from "next/navigation";
import { LoginMethodsSettings } from "@/components/dashboard/login-methods-settings";
import { OIDCSettings } from "@/components/dashboard/oidc-settings";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure system-wide settings and authentication options
        </p>
      </div>

      <LoginMethodsSettings />

      <OIDCSettings />
    </div>
  );
}
