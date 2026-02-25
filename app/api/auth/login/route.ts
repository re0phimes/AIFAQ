import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  const { password } = body;

  if (!password || !verifyPassword(password)) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }

  const token = await createToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  return response;
}
