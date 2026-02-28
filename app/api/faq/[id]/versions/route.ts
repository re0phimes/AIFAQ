import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getVersionsByFaqId, getVersionVoteCounts, getFaqItemById } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  const user = session?.user as { tier?: string; role?: string } | undefined;
  const tier = user?.tier ?? "free";
  const role = user?.role;

  if (tier !== "premium" && role !== "admin") {
    return NextResponse.json({ error: "Premium required" }, { status: 403 });
  }

  const { id } = await params;
  const faqId = parseInt(id, 10);
  const item = await getFaqItemById(faqId);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const versions = await getVersionsByFaqId(faqId);

  // Attach vote counts to each version
  const versionsWithVotes = await Promise.all(
    versions.map(async (v) => ({
      ...v,
      votes: await getVersionVoteCounts(v.id),
    }))
  );

  return NextResponse.json({ versions: versionsWithVotes });
}
