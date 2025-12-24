import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sparkles,
  Rocket,
  Zap,
  Heart,
  Github,
  Mail,
  ArrowRight,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black">
      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="flex flex-col items-center justify-center gap-8 text-center mb-20">
          <div className="flex items-center gap-2">
            <Sparkles className="h-12 w-12 text-blue-600 dark:text-blue-400" />
            <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Aithen
            </h1>
          </div>
          <p className="max-w-2xl text-xl text-zinc-600 dark:text-zinc-400">
            Welcome to your Next.js app with shadcn/ui and Lucide React icons
          </p>
          <div className="flex gap-4">
            <Button size="lg" className="gap-2">
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="gap-2">
              <Github className="h-4 w-4" /> View on GitHub
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <Rocket className="h-10 w-10 mb-2 text-blue-600 dark:text-blue-400" />
              <CardTitle>Fast Performance</CardTitle>
              <CardDescription>
                Built with Next.js 16 and React 19 for optimal performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Server-side rendering, static generation, and more out of the
                box.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="h-10 w-10 mb-2 text-yellow-600 dark:text-yellow-400" />
              <CardTitle>Beautiful Components</CardTitle>
              <CardDescription>
                Powered by shadcn/ui with Tailwind CSS v4
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Accessible, customizable components that you can copy and paste.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Heart className="h-10 w-10 mb-2 text-red-600 dark:text-red-400" />
              <CardTitle>Icon Library</CardTitle>
              <CardDescription>
                500+ beautiful icons from Lucide React
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Clean, consistent, and highly customizable SVG icons.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tech Stack */}
        <Card className="mb-16">
          <CardHeader>
            <CardTitle>Tech Stack</CardTitle>
            <CardDescription>
              Modern tools for modern development
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <p className="font-semibold">Next.js</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  v16.1.1
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="font-semibold">React</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  v19.2.3
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="font-semibold">Tailwind CSS</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">v4</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="font-semibold">TypeScript</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">v5</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="inline-block">
            <CardHeader>
              <CardTitle>Ready to build something amazing?</CardTitle>
              <CardDescription>
                Start editing src/app/page.tsx to see changes in real-time
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4 justify-center">
              <Button variant="outline" className="gap-2">
                <Mail className="h-4 w-4" /> Contact Us
              </Button>
              <Button className="gap-2">
                Start Building <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
