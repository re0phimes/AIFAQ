import { NextResponse } from "next/server";
import { initDB, castVote } from "@/lib/db";

const VALID_TYPES = new Set(["upvote", "outdated", "inaccurate"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const faqId = Number(id);
  if (!Number.isInteger(faqId) || faqId <= 0) {
    return NextResponse.json({ error: "Invalid FAQ ID" }, { status: 400 });
  }

  let body: { type?: string; fingerprint?: string; reason?: string; detail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, fingerprint, reason, detail } = body;
  if (!type || !VALID_TYPES.has(type)) {
    return NextResponse.json(
      { error: "type must be one of: upvote, outdated, inaccurate" },
      { status: 400 }
    );
  }
  if (!fingerprint || typeof fingerprint !== "string") {
    return NextResponse.json(
      { error: "fingerprint is required" },
      { status: 400 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;

  try {
    await initDB();
    const success = await castVote(faqId, type, fingerprint, ip, reason, detail);
    if (!success) {
      return NextResponse.json(
        { error: "Already voted" },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Vote error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
