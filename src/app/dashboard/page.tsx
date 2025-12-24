import { Container, HardDrive, Package, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Get stats (only for admins)
  let userCount = 0;
  if (user?.role === "admin") {
    const users = await db.query.users.findMany();
    userCount = users.length;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.username}! Here's an overview of your registry.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Repositories
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Connect your registry to see repositories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Images</CardTitle>
            <Container className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Across all repositories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 GB</div>
            <p className="text-xs text-muted-foreground">
              Registry storage usage
            </p>
          </CardContent>
        </Card>

        {user?.role === "admin" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCount}</div>
              <p className="text-xs text-muted-foreground">Registered users</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest push and pull operations from your registry
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <div className="text-center">
              <Container className="mx-auto h-12 w-12 opacity-50" />
              <p className="mt-4">No recent activity</p>
              <p className="text-sm">
                Configure your registry connection to see activity
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
