import { NextResponse } from "next/server";
import { initDB, getVotesByFingerprint } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fingerprint = searchParams.get("fingerprint");

  if (!fingerprint) {
    return NextResponse.json({ error: "fingerprint is required" }, { status: 400 });
  }

  try {
    await initDB();
    const votes = await getVotesByFingerprint(fingerprint);
    return NextResponse.json(votes);
  } catch (err) {
    console.error("Get votes error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
