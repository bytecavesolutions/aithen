import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/nav";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardNav user={user} />
      <main className="flex-1 bg-muted/30">
        <div className="container mx-auto py-6 px-4 pb-20 md:pb-6">{children}</div>
      </main>
    </div>
  );
}
