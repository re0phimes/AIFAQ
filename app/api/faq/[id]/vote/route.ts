import { NextResponse } from "next/server";
import { initDB, castVote, castVoteAuth, revokeVote, revokeVoteAuth } from "@/lib/db";
import { auth } from "@/auth";

const VALID_TYPES = new Set(["upvote", "downvote"]);

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
      { error: "type must be one of: upvote, downvote" },
      { status: 400 }
    );
  }

  try {
    await initDB();
    const session = await auth();
    const userId = session?.user?.id;

    if (userId) {
      const result = await castVoteAuth(faqId, type, userId, 5);
      if (!result.inserted) {
        return NextResponse.json({ error: "Already voted" }, { status: 409 });
      }
      return NextResponse.json({ success: true, switched: result.switched, authenticated: true });
    }

    if (!fingerprint || typeof fingerprint !== "string") {
      return NextResponse.json({ error: "fingerprint is required" }, { status: 400 });
    }
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null;
    const result = await castVote(faqId, type, fingerprint, ip, reason, detail);
    if (!result.inserted) {
      return NextResponse.json({ error: "Already voted" }, { status: 409 });
    }
    return NextResponse.json({ success: true, switched: result.switched, authenticated: false });
  } catch (err) {
    console.error("Vote error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const faqId = Number(id);
  if (!Number.isInteger(faqId) || faqId <= 0) {
    return NextResponse.json({ error: "Invalid FAQ ID" }, { status: 400 });
  }

  try {
    await initDB();
    const session = await auth();
    const userId = session?.user?.id;

    if (userId) {
      const success = await revokeVoteAuth(faqId, userId);
      if (!success) return NextResponse.json({ error: "No vote found" }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    let body: { fingerprint?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { fingerprint } = body;
    if (!fingerprint || typeof fingerprint !== "string") {
      return NextResponse.json({ error: "fingerprint is required" }, { status: 400 });
    }
    const success = await revokeVote(faqId, fingerprint);
    if (!success) return NextResponse.json({ error: "No vote found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Revoke vote error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
