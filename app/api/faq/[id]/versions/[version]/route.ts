import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getVersionsByFaqId, getVersionVoteCounts } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> }
): Promise<NextResponse> {
  const session = await auth();
  const user = session?.user as { tier?: string; role?: string } | undefined;
  const tier = user?.tier ?? "free";
  const role = user?.role;

  if (tier !== "premium" && role !== "admin") {
    return NextResponse.json({ error: "Premium required" }, { status: 403 });
  }

  const { id, version } = await params;
  const faqId = parseInt(id, 10);
  const versionNum = parseInt(version, 10);

  const versions = await getVersionsByFaqId(faqId);
  const target = versions.find(v => v.version === versionNum);
  if (!target) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const votes = await getVersionVoteCounts(target.id);
  return NextResponse.json({ ...target, votes });
}
