import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_token";

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error("ADMIN_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export async function getAuthStatus(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyToken(token);
}

export function verifyPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD is not set");
  return password === expected;
}

export { COOKIE_NAME };
