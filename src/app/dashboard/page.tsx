import { Container, Layers, Package, Users } from "lucide-react";
import { RegistryStatus } from "@/components/dashboard/registry-status";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import {
  checkRegistryHealth,
  getAllRepositoriesGrouped,
  getCatalog,
  getUserRepositories,
} from "@/lib/registry";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Get stats (only for admins)
  let userCount = 0;
  if (user?.role === "admin") {
    const users = await db.query.users.findMany();
    userCount = users.length;
  }

  // Get registry stats
  const isHealthy = await checkRegistryHealth();
  let repositoryCount = 0;
  let imageCount = 0;

  if (isHealthy && user) {
    try {
      if (user.role === "admin") {
        const allRepos = await getCatalog();
        repositoryCount = allRepos.length;
        const grouped = await getAllRepositoriesGrouped();
        for (const repos of grouped.values()) {
          imageCount += repos.reduce((sum, r) => sum + r.imageCount, 0);
        }
      } else {
        const userRepos = await getUserRepositories(user.username);
        repositoryCount = userRepos.length;
        imageCount = userRepos.reduce((sum, r) => sum + r.imageCount, 0);
      }
    } catch (error) {
      console.error("Error fetching registry stats:", error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.username}! Here's an overview of your registry.
          </p>
        </div>
        <RegistryStatus isHealthy={isHealthy} />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {user?.role === "admin"
                ? "Total Repositories"
                : "Your Repositories"}
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repositoryCount}</div>
            <p className="text-xs text-muted-foreground">
              {isHealthy
                ? user?.role === "admin"
                  ? "Across all users"
                  : `In ${user?.username}/ namespace`
                : "Registry offline"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Images</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{imageCount}</div>
            <p className="text-xs text-muted-foreground">
              {isHealthy ? "Tagged images in registry" : "Registry offline"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Your Namespace
            </CardTitle>
            <Container className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {user?.username}/
            </div>
            <p className="text-xs text-muted-foreground">
              Push images to this prefix
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
          <CardTitle>Quick Start</CardTitle>
          <CardDescription>
            Get started pushing images to your private registry
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 font-mono text-sm">
            <p className="text-muted-foreground"># Login to the registry</p>
            <p>docker login localhost:5000</p>
            <p className="mt-4 text-muted-foreground">
              # Tag your image with your namespace
            </p>
            <p>
              docker tag myimage:latest localhost:5000/{user?.username}
              /myimage:latest
            </p>
            <p className="mt-4 text-muted-foreground"># Push to registry</p>
            <p>docker push localhost:5000/{user?.username}/myimage:latest</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Use your Aithen username and password to authenticate.
            {user?.role !== "admin" &&
              " You can only push images to your own namespace."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
