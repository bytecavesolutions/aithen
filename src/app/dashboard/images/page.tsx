import { eq } from "drizzle-orm";
import { Container, Hash, Package, RefreshCw, Tag } from "lucide-react";
import { redirect } from "next/navigation";
import { ImagesTable } from "@/components/dashboard/images-table";
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
import { namespaces } from "@/db/schema";
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

export default async function ImagesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Get registry URL from environment and extract host:port
  const registryUrl = process.env.REGISTRY_URL || "http://localhost:5000";
  const registryHost = registryUrl.replace(/^https?:\/\//, "");

  const isHealthy = await checkRegistryHealth();

  let repositories: Awaited<ReturnType<typeof getUserRepositories>> = [];
  let groupedRepositories: Record<
    string,
    Awaited<ReturnType<typeof getUserRepositories>>
  > | null = null;
  let totalImages = 0;
  let totalTags = 0;
  let totalRepos = 0;
  let namespaceCount = 0;

  // Get user's namespaces from database
  let userNamespaces: string[] = [];
  try {
    const userNs = await db.query.namespaces.findMany({
      where: eq(namespaces.userId, user.id),
    });
    userNamespaces = userNs.map((ns) => ns.name).sort();
  } catch (error) {
    console.error("Error fetching user namespaces:", error);
  }

  if (isHealthy) {
    try {
      if (user.role === "admin") {
        // Try to get from cache first
        const cached =
          await getCachedData<CachedRepositories>("repositories:all");

        if (cached) {
          // Use cached data (instant load)
          groupedRepositories = cached.groupedRepositories;
          totalImages = cached.totalImages;
          totalTags = cached.totalTags;
          totalRepos = cached.totalRepos;
          namespaceCount = cached.namespaceCount;
        } else {
          // Fallback to live fetch (cache miss)
          const liveData = await getAllRepositoriesGrouped();
          groupedRepositories = Object.fromEntries(liveData);
          for (const repos of liveData.values()) {
            totalImages += repos.reduce((sum, r) => sum + r.imageCount, 0);
            totalTags += repos.reduce((sum, r) => sum + r.tagCount, 0);
            totalRepos += repos.length;
          }
          namespaceCount = liveData.size;
        }
      } else {
        // Try to get user's namespace from cache
        const cached = await getCachedData<CachedUserRepositories>(
          `repositories:namespace:${user.username.toLowerCase()}`,
        );

        if (cached) {
          // Use cached data
          repositories = cached.repositories;
          totalImages = cached.totalImages;
          totalTags = cached.totalTags;
          totalRepos = cached.totalRepos;
        } else {
          // Fallback to live fetch
          repositories = await getUserRepositories(user.id);
          totalImages = repositories.reduce((sum, r) => sum + r.imageCount, 0);
          totalTags = repositories.reduce((sum, r) => sum + r.tagCount, 0);
          totalRepos = repositories.length;
        }
      }
    } catch (error) {
      console.error("Error fetching repositories:", error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Images
          </h1>
          <p className="text-sm text-muted-foreground truncate">
            {user.role === "admin"
              ? "Manage all container images"
              : `Images in ${user.username}/ namespace`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {user.role === "admin" && <RefreshCacheButton />}
          <RegistryStatus isHealthy={isHealthy} />
        </div>
      </div>

      {!isHealthy ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Container className="h-5 w-5" />
              Registry Unavailable
            </CardTitle>
            <CardDescription>
              Cannot connect to the Docker registry. Please ensure it is
              running.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed p-6 text-center">
              <RefreshCw className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <p className="mt-4 text-sm text-muted-foreground">
                Start the registry with:{" "}
                <code className="rounded bg-muted px-2 py-1">
                  docker-compose up -d
                </code>
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {user.role === "admin"
                    ? "Total Repositories"
                    : "Your Repositories"}
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalRepos}</div>
                <p className="text-xs text-muted-foreground">
                  {user.role === "admin"
                    ? `Across ${namespaceCount} namespaces`
                    : `In ${user.username}/ namespace`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Unique Images
                </CardTitle>
                <Hash className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalImages}</div>
                <p className="text-xs text-muted-foreground">
                  Distinct image digests
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Tags
                </CardTitle>
                <Tag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalTags}</div>
                <p className="text-xs text-muted-foreground">
                  Tag references in registry
                </p>
              </CardContent>
            </Card>

            {user.role !== "admin" && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Your Namespace
                  </CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">
                    {user.username}/
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Push images to this namespace
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {user.role === "admin" && groupedRepositories ? (
            <ImagesTable
              groupedRepositories={groupedRepositories}
              isAdmin={true}
              userNamespaces={userNamespaces}
            />
          ) : (
            <ImagesTable repositories={repositories} isAdmin={false} />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Push Instructions</CardTitle>
              <CardDescription>
                How to push images to your namespace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4 font-mono text-sm">
                <p className="text-muted-foreground"># Login to the registry</p>
                <p>docker login {registryHost}</p>
                <p className="mt-4 text-muted-foreground"># Tag your image</p>
                <p>
                  docker tag myimage:latest {registryHost}/{user.username}
                  /myimage:latest
                </p>
                <p className="mt-4 text-muted-foreground"># Push to registry</p>
                <p>
                  docker push {registryHost}/{user.username}/myimage:latest
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Use your Aithen username and password to authenticate with the
                registry.
                {user.role !== "admin" &&
                  " You can only push to your own namespace."}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
