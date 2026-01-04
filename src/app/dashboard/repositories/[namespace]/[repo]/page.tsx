import {
  ArrowLeft,
  Container,
  Copy,
  Cpu,
  Hash,
  Layers,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import { formatBytes, getRepository } from "@/lib/registry";
import { isUserRepository } from "@/lib/registry-token";
import { DeleteImageButton } from "./delete-image-button";

interface RepositoryPageProps {
  params: Promise<{
    namespace: string;
    repo: string;
  }>;
}

function truncateDigest(digest: string): string {
  if (!digest) return "";
  const hash = digest.replace("sha256:", "");
  return hash.substring(0, 12);
}

function getArchitectureColor(arch: string): string {
  if (arch.includes("amd64") || arch.includes("x86_64")) {
    return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
  }
  if (arch.includes("arm64") || arch.includes("aarch64")) {
    return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
  }
  if (arch.includes("arm")) {
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  }
  if (arch.includes("386") || arch.includes("i386")) {
    return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
  }
  if (arch.includes("s390x") || arch.includes("ppc64")) {
    return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
  }
  return "bg-muted text-muted-foreground";
}

function formatPlatform(arch: string, os?: string): string {
  if (os && os !== "linux") {
    return `${os}/${arch}`;
  }
  return arch;
}

export default async function RepositoryPage({ params }: RepositoryPageProps) {
  const { namespace, repo } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const fullName = `${namespace}/${repo}`;

  // Check access permissions
  if (user.role !== "admin" && !isUserRepository(fullName, user.username)) {
    notFound();
  }

  const repository = await getRepository(fullName);

  if (!repository) {
    notFound();
  }

  const totalSize = repository.images.reduce((sum, img) => sum + img.size, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/images">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Container className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-3xl font-bold tracking-tight font-mono">
              {fullName}
            </h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Repository details and image management
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Images</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repository.imageCount}</div>
            <p className="text-xs text-muted-foreground">Unique digests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tags</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repository.tagCount}</div>
            <p className="text-xs text-muted-foreground">Tag references</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            <Container className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(totalSize)}</div>
            <p className="text-xs text-muted-foreground">Combined size</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Namespace</CardTitle>
            <Container className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{namespace}/</div>
            <p className="text-xs text-muted-foreground">Owner namespace</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Images</CardTitle>
          <CardDescription>
            All images in this repository grouped by digest
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Digest</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Architecture</TableHead>
                <TableHead>Layers</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="text-right w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repository.images.map((image) => (
                <TableRow key={image.digest} className="group">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      <Link
                        href={`/dashboard/repositories/${namespace}/${repo}/images/${encodeURIComponent(image.digest)}`}
                        className="font-mono text-sm hover:underline"
                      >
                        {truncateDigest(image.digest)}
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        title="Copy full digest"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {image.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="font-mono text-xs"
                        >
                          <Tag className="mr-1 h-3 w-3" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {image.isMultiArch && image.platforms ? (
                        <>
                          {image.platforms
                            .filter(
                              (p) =>
                                p.architecture !== "unknown" &&
                                p.os !== "unknown",
                            )
                            .slice(0, 3)
                            .map((p) => (
                              <Badge
                                key={p.digest}
                                variant="outline"
                                className={`text-xs ${getArchitectureColor(p.architecture)}`}
                                title={`${p.os}/${p.architecture} - ${formatBytes(p.size)} (${p.layerCount} layers)`}
                              >
                                <Cpu className="mr-1 h-3 w-3" />
                                {formatPlatform(p.architecture, p.os)}
                              </Badge>
                            ))}
                          {image.platforms.filter(
                            (p) =>
                              p.architecture !== "unknown" &&
                              p.os !== "unknown",
                          ).length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +
                              {image.platforms.filter(
                                (p) =>
                                  p.architecture !== "unknown" &&
                                  p.os !== "unknown",
                              ).length - 3}
                            </Badge>
                          )}
                        </>
                      ) : image.architecture &&
                        image.architecture !== "unknown" ? (
                        <Badge
                          variant="outline"
                          className={`text-xs ${getArchitectureColor(image.architecture)}`}
                        >
                          <Cpu className="mr-1 h-3 w-3" />
                          {formatPlatform(image.architecture, image.os)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {image.layerCount !== undefined && image.layerCount > 0 ? (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Layers className="h-3.5 w-3.5" />
                        <span>{image.layerCount}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatBytes(image.size)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteImageButton
                      repository={fullName}
                      digest={image.digest}
                      tags={image.tags}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pull Commands</CardTitle>
          <CardDescription>
            Commands to pull images from this repository
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 font-mono text-sm space-y-2">
            <p className="text-muted-foreground"># Pull by tag</p>
            {repository.tags.slice(0, 3).map((tag) => (
              <p key={tag}>
                docker pull{" "}
                {process.env.NEXT_PUBLIC_ORIGIN?.replace(
                  /^https?:\/\//,
                  "",
                ).split(":")[0] || "localhost"}
                :5000/{fullName}:{tag}
              </p>
            ))}
            {repository.tags.length > 3 && (
              <p className="text-muted-foreground">
                ... and {repository.tags.length - 3} more tags
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
