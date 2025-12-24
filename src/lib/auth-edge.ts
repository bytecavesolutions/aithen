import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
	process.env.JWT_SECRET || "dev-secret-key-change-in-production",
);

const SESSION_EXPIRY_DAYS = Number.parseInt(
	process.env.SESSION_EXPIRY_DAYS || "7",
	10,
);

export interface JWTPayload {
	userId: number;
	username: string;
	role: "admin" | "user";
	sessionId: string;
}

export async function createToken(payload: JWTPayload): Promise<string> {
	return new SignJWT({ ...payload })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(`${SESSION_EXPIRY_DAYS}d`)
		.sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
	try {
		const { payload } = await jwtVerify(token, JWT_SECRET);
		return payload as unknown as JWTPayload;
	} catch {
		return null;
	}
}
