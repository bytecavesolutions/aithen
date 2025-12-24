"use client";

import {
  Container,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DashboardNavProps {
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
  };
}

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/users",
    label: "Users",
    icon: Users,
    adminOnly: true,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
  },
];

export function DashboardNav({ user }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const filteredNavItems = navItems.filter(
    (item) => !item.adminOnly || user.role === "admin",
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Container className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Registry Hub</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {filteredNavItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={pathname === item.href ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "gap-2",
                    pathname === item.href && "bg-secondary",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {user.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{user.username}</p>
                  <Badge
                    variant={user.role === "admin" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {user.role}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
