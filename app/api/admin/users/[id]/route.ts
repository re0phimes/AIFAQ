import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { setUserTier } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { tier } = await request.json();
  if (!["free", "premium"].includes(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }
  await setUserTier(id, tier);
  return NextResponse.json({ ok: true });
}
