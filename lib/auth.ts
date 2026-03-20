import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

function isValidAdminApiKey(token: string): boolean {
  const configuredKey = process.env.ADMIN_API_KEY;
  if (!configuredKey) return false;

  const provided = Buffer.from(token);
  const expected = Buffer.from(configuredKey);
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}

/** Check if current request is from an admin user */
export async function verifyAdmin(request?: NextRequest): Promise<boolean> {
  const authHeader = request?.headers.get("authorization");
  if (authHeader) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      return false;
    }
    return isValidAdminApiKey(token);
  }

  const session = await auth();
  return session?.user?.role === "admin";
}
