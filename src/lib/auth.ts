import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema } from "@/db";
import { type JWTPayload, verifyToken } from "./auth-edge";

export { createToken, type JWTPayload, verifyToken } from "./auth-edge";

const SESSION_EXPIRY_DAYS = Number.parseInt(
  process.env.SESSION_EXPIRY_DAYS || "7",
  10,
);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: number): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  await db.insert(schema.sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  });

  return sessionId;
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  // Verify session exists in database
  const session = await db.query.sessions.findFirst({
    where: eq(schema.sessions.id, payload.sessionId),
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return payload;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.userId),
  });

  if (!user) {
    return null;
  }

  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("auth-token");
}
