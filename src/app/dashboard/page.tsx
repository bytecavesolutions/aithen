import { Container, Hash, Package, Tag, Users } from "lucide-react";
import { RefreshCacheButton } from "@/components/dashboard/refresh-cache-button";
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
  getUserRepositories,
} from "@/lib/registry";
import {
  type CachedRepositories,
  type CachedUserRepositories,
  getCachedData,
} from "@/lib/registry-cache";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Get registry URL from environment and extract host:port
  const registryUrl = process.env.REGISTRY_URL || "http://localhost:5000";
  const registryHost = registryUrl.replace(/^https?:\/\//, "");

  // Get stats (only for admins)
  let userCount = 0;
  if (user?.role === "admin") {
    const users = await db.query.users.findMany();
    userCount = users.length;
  }

  // Get registry stats
  const isHealthy = await checkRegistryHealth();
  let totalRepos = 0;
  let totalImages = 0;
  let totalTags = 0;
  let namespaceCount = 0;

  if (isHealthy && user) {
    try {
      if (user.role === "admin") {
        // Try to get from cache first
        const cached =
          await getCachedData<CachedRepositories>("repositories:all");

        if (cached) {
          // Use cached data (instant load)
          totalRepos = cached.totalRepos;
          totalImages = cached.totalImages;
          totalTags = cached.totalTags;
          namespaceCount = cached.namespaceCount;
        } else {
          // Fallback to live fetch (cache miss)
          const grouped = await getAllRepositoriesGrouped();
          for (const repos of grouped.values()) {
            totalImages += repos.reduce((sum, r) => sum + r.imageCount, 0);
            totalTags += repos.reduce((sum, r) => sum + r.tagCount, 0);
            totalRepos += repos.length;
          }
          namespaceCount = grouped.size;
        }
      } else {
        // Try to get user's namespace from cache
        const cached = await getCachedData<CachedUserRepositories>(
          `repositories:namespace:${user.username.toLowerCase()}`,
        );

        if (cached) {
          // Use cached data
          totalRepos = cached.totalRepos;
          totalImages = cached.totalImages;
          totalTags = cached.totalTags;
        } else {
          // Fallback to live fetch
          const userRepos = await getUserRepositories(user.id);
          totalRepos = userRepos.length;
          totalImages = userRepos.reduce((sum, r) => sum + r.imageCount, 0);
          totalTags = userRepos.reduce((sum, r) => sum + r.tagCount, 0);
        }
      }
    } catch (error) {
      console.error("Error fetching registry stats:", error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground truncate">
            Welcome back, {user?.username}!
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {user?.role === "admin" && <RefreshCacheButton />}
          <RegistryStatus isHealthy={isHealthy} />
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Total Repositories
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRepos}</div>
            <p className="text-xs text-muted-foreground">
              {isHealthy
                ? user?.role === "admin"
                  ? `Across ${namespaceCount} namespaces`
                  : `In ${user?.username}/ namespace`
                : "Registry offline"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Unique Images
            </CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalImages}</div>
            <p className="text-xs text-muted-foreground">
              {isHealthy ? "Distinct image digests" : "Registry offline"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Total Tags
            </CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTags}</div>
            <p className="text-xs text-muted-foreground">
              {isHealthy ? "Tag references in registry" : "Registry offline"}
            </p>
          </CardContent>
        </Card>

        {user?.role === "admin" ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">
                Total Users
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCount}</div>
              <p className="text-xs text-muted-foreground">Registered users</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">
                Your Namespace
              </CardTitle>
              <Container className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold font-mono truncate">
                {user?.username}/
              </div>
              <p className="text-xs text-muted-foreground">
                Push images to this namespace
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-base sm:text-lg">Quick Start</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Get started pushing images to your private registry
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-3 sm:p-4 font-mono text-xs sm:text-sm overflow-x-auto">
            <p className="text-muted-foreground"># Login to the registry</p>
            <p className="whitespace-nowrap">docker login {registryHost}</p>
            <p className="mt-3 sm:mt-4 text-muted-foreground">
              # Tag your image with your namespace
            </p>
            <p className="whitespace-nowrap">
              docker tag myimage:latest {registryHost}/{user?.username}
              /myimage:latest
            </p>
            <p className="mt-3 sm:mt-4 text-muted-foreground">
              # Push to registry
            </p>
            <p className="whitespace-nowrap">
              docker push {registryHost}/{user?.username}/myimage:latest
            </p>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Use your Aithen username and password to authenticate.
            {user?.role !== "admin" &&
              " You can only push images to your own namespace."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
