import { redirect } from "next/navigation";
import { NamespaceManagement } from "@/components/dashboard/namespace-management";
import { db } from "@/db";
import { getCurrentUser } from "@/lib/auth";

export default async function NamespacesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Get all namespaces (admin sees all, users see their own)
  const namespaces =
    user.role === "admin"
      ? await db.query.namespaces.findMany({
          orderBy: (namespaces, { desc }) => [desc(namespaces.createdAt)],
          with: {
            user: {
              columns: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        })
      : await db.query.namespaces.findMany({
          where: (namespaces, { eq }) => eq(namespaces.userId, user.id),
          orderBy: (namespaces, { desc }) => [desc(namespaces.createdAt)],
        });

  // Get all users (for admin to select namespace owner)
  const users =
    user.role === "admin"
      ? await db.query.users.findMany({
          columns: {
            id: true,
            username: true,
            email: true,
          },
          orderBy: (users, { asc }) => [asc(users.username)],
        })
      : [];

  return (
    <NamespaceManagement
      namespaces={namespaces}
      users={users}
      isAdmin={user.role === "admin"}
    />
  );
}
