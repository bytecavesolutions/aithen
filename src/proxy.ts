import { type NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth-edge";
import { needsSetup } from "@/lib/setup";

const publicPaths = [
  "/login",
  "/api/auth/login",
  "/api/auth/passkey/check",
  "/api/auth/passkey/login/options",
  "/api/auth/passkey/login/verify",
  "/api/registry/token", // Docker registry token endpoint (uses Basic auth)
  "/api/registry/jwks", // JWKS endpoint for public key discovery
];
const setupPaths = ["/setup", "/api/setup", "/api/setup/check"];
const adminOnlyPaths = ["/dashboard/users", "/api/users"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // FIRST PRIORITY: Check if initial setup is needed (server-side only)
  // This runs before any authentication checks
  // If database doesn't exist or no admin user, redirect to setup
  const setupRequired = await needsSetup();

  if (setupRequired) {
    // Allow setup paths when setup is required
    if (setupPaths.some((path) => pathname.startsWith(path))) {
      return NextResponse.next();
    }
    // Redirect everything else to setup (including login, home, dashboard, etc.)
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  // If setup is complete but user is on setup page, redirect to login
  if (setupPaths.some((path) => pathname.startsWith(path)) && !setupRequired) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // SECOND PRIORITY: Allow public paths (login, etc.) if setup is complete
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // THIRD PRIORITY: Check authentication for all other paths

  // Check for auth token
  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Verify token
  const payload = await verifyToken(token);

  if (!payload) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("auth-token");
    return response;
  }

  // Check admin-only paths
  if (adminOnlyPaths.some((path) => pathname.startsWith(path))) {
    if (payload.role !== "admin") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Redirect root to dashboard for authenticated users
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
