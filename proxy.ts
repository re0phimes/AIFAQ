import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "admin_token";

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return new TextEncoder().encode("fallback-dev-secret");
  return new TextEncoder().encode(secret);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Only protect /admin (not /admin/login)
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  try {
    await jwtVerify(token, getSecret());
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
