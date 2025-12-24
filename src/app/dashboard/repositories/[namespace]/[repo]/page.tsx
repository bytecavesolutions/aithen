import { ArrowLeft, Container, Copy, Hash, Tag } from "lucide-react";
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
