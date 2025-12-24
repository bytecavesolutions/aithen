import {
  type AuthenticationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  type VerifiedAuthenticationResponse,
  type VerifiedRegistrationResponse,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

// Get RP (Relying Party) name and ID from environment or use defaults
const RP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Aithen Registry Hub";
const RP_ID = process.env.NEXT_PUBLIC_RP_ID || "localhost";
const ORIGIN = process.env.NEXT_PUBLIC_ORIGIN || "http://localhost:3000";

export async function generateRegistrationOpts(userId: number) {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Get existing passkeys for the user
  const existingPasskeys = await db.query.passkeys.findMany({
    where: eq(schema.passkeys.userId, userId),
  });

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(`user_${user.id}`),
    userName: user.username,
    userDisplayName: user.email,
    timeout: 60000,
    attestationType: "none",
    excludeCredentials: existingPasskeys.map((passkey) => ({
      id: passkey.credentialId,
      transports: passkey.transports
        ? (JSON.parse(passkey.transports) as AuthenticatorTransport[])
        : undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  // Store the challenge for later verification
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  await db.insert(schema.passkeyVerifications).values({
    id: crypto.randomUUID(),
    userId,
    challenge: options.challenge,
    expiresAt,
  });

  return options;
}

export async function verifyRegistration(
  userId: number,
  response: RegistrationResponseJSON,
): Promise<VerifiedRegistrationResponse> {
  // Get the challenge from database
  const verification = await db.query.passkeyVerifications.findFirst({
    where: eq(schema.passkeyVerifications.userId, userId),
    orderBy: (verifications, { desc }) => [desc(verifications.createdAt)],
  });

  if (!verification || verification.expiresAt < new Date()) {
    throw new Error("Invalid or expired challenge");
  }

  const verified = await verifyRegistrationResponse({
    response,
    expectedChallenge: verification.challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  if (!verified.verified || !verified.registrationInfo) {
    throw new Error("Registration verification failed");
  }

  // Store the passkey
  const { credential } = verified.registrationInfo;
  const credentialID = credential.id;
  const credentialPublicKey = credential.publicKey;
  const counter = credential.counter;

  await db.insert(schema.passkeys).values({
    id: crypto.randomUUID(),
    userId,
    credentialId: credentialID,
    publicKey: Buffer.from(credentialPublicKey).toString("base64url"),
    counter,
    transports: response.response.transports
      ? JSON.stringify(response.response.transports)
      : null,
    deviceName: `Passkey registered on ${new Date().toLocaleDateString()}`,
  });

  // Clean up used verification
  await db
    .delete(schema.passkeyVerifications)
    .where(eq(schema.passkeyVerifications.id, verification.id));

  return verified;
}

export async function generateAuthenticationOpts(_username?: string) {
  console.log(
    "🔑 Generating authentication options (discoverable credentials)",
  );
  console.log("Environment:", { RP_ID, ORIGIN, RP_NAME });

  // Use discoverable credentials (no allowCredentials) for passwordless flow
  // This allows the browser to show all passkeys for this domain
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    timeout: 60000,
    userVerification: "preferred",
    // Don't set allowCredentials to enable discoverable credentials
  });

  console.log("✅ Authentication options generated");
  // Store challenge temporarily (we'll use it for verification)
  // For authentication, we'll store it in memory/session rather than DB
  return options;
}

export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
): Promise<{ verified: boolean; userId: number | null }> {
  // Find the passkey by credential ID
  const _credentialId = response.id;
  const passkey = await db.query.passkeys.findFirst({
    where: eq(schema.passkeys.credentialId, response.id),
  });

  if (!passkey) {
    return { verified: false, userId: null };
  }

  const verification: VerifiedAuthenticationResponse =
    await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: passkey.credentialId,
        publicKey: Buffer.from(passkey.publicKey, "base64url"),
        counter: passkey.counter,
      },
    });

  if (!verification.verified) {
    return { verified: false, userId: null };
  }

  // Update counter and last used timestamp
  await db
    .update(schema.passkeys)
    .set({
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    })
    .where(eq(schema.passkeys.id, passkey.id));

  return { verified: true, userId: passkey.userId };
}
