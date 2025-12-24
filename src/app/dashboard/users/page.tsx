import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { UsersTable } from "@/components/dashboard/users-table";
import { CreateUserDialog } from "@/components/dashboard/create-user-dialog";

export default async function UsersPage() {
	const currentUser = await getCurrentUser();

	if (!currentUser || currentUser.role !== "admin") {
		redirect("/dashboard");
	}

	const users = await db.query.users.findMany({
		orderBy: (users, { desc }) => [desc(users.createdAt)],
	});

	const safeUsers = users.map(({ passwordHash: _, ...user }) => user);

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">User Management</h1>
					<p className="text-muted-foreground">
						Create and manage users who can access the registry
					</p>
				</div>
				<CreateUserDialog />
			</div>

			<UsersTable users={safeUsers} currentUserId={currentUser.id} />
		</div>
	);
}
