import { ArrowLeft, Box, Copy, Hash, Layers, Tag } from "lucide-react";
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
import { formatBytes, getDetailedManifest } from "@/lib/registry";
import { isUserRepository } from "@/lib/registry-token";
import { DeleteImageButton } from "../../delete-image-button";

interface ImageDetailPageProps {
  params: Promise<{
    namespace: string;
    repo: string;
    digest: string;
  }>;
}

function truncateDigest(digest: string): string {
  if (!digest) return "";
  const hash = digest.replace("sha256:", "");
  return hash.substring(0, 12);
}

export default async function ImageDetailPage({
  params,
}: ImageDetailPageProps) {
  const { namespace, repo, digest: encodedDigest } = await params;
  const digest = decodeURIComponent(encodedDigest);
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const fullName = `${namespace}/${repo}`;

  // Check access permissions
  if (user.role !== "admin" && !isUserRepository(fullName, user.username)) {
    notFound();
  }

  const manifest = await getDetailedManifest(fullName, digest);

  if (!manifest) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/repositories/${namespace}/${repo}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Hash className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight font-mono">
              {truncateDigest(manifest.digest)}
            </h1>
            <Badge variant="secondary" className="font-mono">
              {manifest.tags.length}{" "}
              {manifest.tags.length === 1 ? "tag" : "tags"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            {fullName}@{manifest.digest}
          </p>
        </div>
        <DeleteImageButton
          repository={fullName}
          digest={manifest.digest}
          tags={manifest.tags}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(manifest.size)}
            </div>
            <p className="text-xs text-muted-foreground">Compressed size</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Layers</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{manifest.layers.length}</div>
            <p className="text-xs text-muted-foreground">Image layers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tags</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{manifest.tags.length}</div>
            <p className="text-xs text-muted-foreground">Tag references</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Media Type</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className="text-sm font-mono truncate"
              title={manifest.mediaType}
            >
              {manifest.mediaType.split(".").pop()}
            </div>
            <p className="text-xs text-muted-foreground">Manifest format</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            All tags pointing to this image digest
          </CardDescription>
        </CardHeader>
        <CardContent>
          {manifest.tags.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No tags point to this digest. The image may be orphaned.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {manifest.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="font-mono text-sm px-3 py-1"
                >
                  <Tag className="mr-2 h-3.5 w-3.5" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Digest</CardTitle>
          <CardDescription>
            Full content-addressable digest for this image
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
            <code className="flex-1 font-mono text-sm break-all">
              {manifest.digest}
            </code>
            <Button variant="ghost" size="icon-sm" title="Copy digest">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {manifest.config && (
        <Card>
          <CardHeader>
            <CardTitle>Config</CardTitle>
            <CardDescription>Image configuration blob</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted p-4 font-mono text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Digest:</span>
                <span className="truncate max-w-[60%]">
                  {manifest.config.digest}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size:</span>
                <span>{formatBytes(manifest.config.size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Media Type:</span>
                <span className="truncate max-w-[60%]">
                  {manifest.config.mediaType}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Layers</CardTitle>
          <CardDescription>
            Image filesystem layers (ordered from base to top)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Digest</TableHead>
                <TableHead>Media Type</TableHead>
                <TableHead className="text-right">Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {manifest.layers.map((layer, index) => (
                <TableRow key={layer.digest}>
                  <TableCell className="text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <code className="font-mono text-xs">
                      {truncateDigest(layer.digest)}
                    </code>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {layer.mediaType.split(".").pop()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatBytes(layer.size)}
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
            Commands to pull this specific image
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 font-mono text-sm space-y-3">
            <div>
              <p className="text-muted-foreground mb-1">
                # Pull by digest (immutable)
              </p>
              <p className="break-all">
                docker pull{" "}
                {process.env.NEXT_PUBLIC_ORIGIN?.replace(
                  /^https?:\/\//,
                  "",
                ).split(":")[0] || "localhost"}
                :5000/{fullName}@{manifest.digest}
              </p>
            </div>
            {manifest.tags.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1"># Pull by tag</p>
                <p>
                  docker pull{" "}
                  {process.env.NEXT_PUBLIC_ORIGIN?.replace(
                    /^https?:\/\//,
                    "",
                  ).split(":")[0] || "localhost"}
                  :5000/{fullName}:{manifest.tags[0]}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
